import {
    useCallback,
    useEffect,
    useMemo,
    useRef,
    useState,
    type FormEvent as ReactFormEvent,
    type ReactNode,
    type KeyboardEvent as ReactKeyboardEvent,
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
    MsegPreview,
    RangeField,
    VOICE_MODE_OPTIONS,
    VoiceGlideControlSurface,
    WavetableStageSection,
} from "../shared/synth-components";
import { DistortionVisualizer } from "../shared/distortion-visualizer";
import type { DistortionHistoryFrame, DistortionScopeFrame } from "../shared/distortion-visualization";
import {
    KeyboardDock,
    type PianoKeyboardElement,
} from "./desktop-keyboard-adapter";
import { NexusNumberField } from "./desktop-nexus-number-field";
import { PrecisionNumberField } from "./desktop-precision-number-field";
import { useDesktopCurveLab } from "./desktop-curve-lab";
import { DesktopModMatrix } from "./desktop-mod-matrix";
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
    MODULATION_ENV_SLOT_COUNT,
    MODULATION_MSEG_SLOT_COUNT,
    type ModulationRoute,
} from "../shared/modulation";

const KEYBOARD_ROOT_NOTE_DEFAULT = 36;
const KEYBOARD_ROOT_NOTE_MIN = 12;
const KEYBOARD_ROOT_NOTE_MAX = 72;
const GLIDE_TIME_MIN_SECONDS = 0;
const GLIDE_TIME_MAX_SECONDS = 2;
const GLIDE_TIME_STEP_SECONDS = 0.001;
const ENVELOPE_TIME_MIN_SECONDS = 0.001;
const ENVELOPE_TIME_MAX_SECONDS = 10;
const ENVELOPE_TIME_RESPONSE = 1.4;
const ENVELOPE_NOTE_OFF_RATIO = 0.76;
const ENVELOPE_VIEWBOX = {
    width: 920,
    height: 520,
    left: 44,
    right: 44,
    top: 42,
    bottom: 118,
} as const;
const DESKTOP_GRID_CARD_CLASS = "aspect-[50/27] min-h-[198px]";
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
const DISTORTION_MODE_OPTIONS = [
    { value: 0, label: "Classic", summary: "Equal-power crossfade between dry and clipped wet." },
    { value: 1, label: "Harmonics", summary: "Keep the dry body and add only the nonlinear residue." },
] as const;
const DISTORTION_WET_HP_MIN_HZ = 20;
const DISTORTION_WET_HP_MAX_HZ = 4_000;
const DISTORTION_WET_LP_MIN_HZ = 20;
const DISTORTION_WET_LP_MAX_HZ = 20_000;
const CHORUS_MOTION_MODE_OPTIONS = ["Subtle", "Wide", "Classic", "Fast"] as const;
const CHORUS_BLOOM_MODE_OPTIONS = ["Clean", "Small", "Large", "Sm+Sh", "Lg+Sh"] as const;
const CHORUS_RING_OFFSET_MODE_OPTIONS = ["+5th", "Low 5th", "+Oct", "-Oct"] as const;
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

type DistortionSectionProps = {
    distortionMode: PatchControlBinding<number>;
    distortionDriveDb: PatchControlBinding<number>;
    distortionKnee: PatchControlBinding<number>;
    distortionWet: PatchControlBinding<number>;
    distortionWetHPHz: PatchControlBinding<number>;
    distortionWetLPHz: PatchControlBinding<number>;
    observedDistortionHistory: DistortionHistoryFrame | null;
    observedDistortionScope: DistortionScopeFrame | null;
    className?: string;
};

type EffectsRackSectionProps = {
    chorusEnabled: PatchControlBinding<number>;
    chorusMix: PatchControlBinding<number>;
    chorusMotionMode: PatchControlBinding<number>;
    chorusBloomMode: PatchControlBinding<number>;
    chorusTone: PatchControlBinding<number>;
    chorusFeedback: PatchControlBinding<number>;
    chorusRingAmount: PatchControlBinding<number>;
    chorusRingOffsetMode: PatchControlBinding<number>;
    chorusRingFineSemitones: PatchControlBinding<number>;
    className?: string;
};

type ChorusEffectColumnProps = Omit<EffectsRackSectionProps, "className">;

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
    selectedMsegSlot: number;
    msegState: MsegState | null;
    observedMsegPlayhead: ReturnType<typeof useSynthPatchViewModel>["observedMsegPlayhead"];
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

function formatDriveDb(value: number) {
    return `${value.toFixed(1)} dB`;
}

function formatUnitPercent(value: number) {
    return `${Math.round(clamp(value, 0, 1) * 100)}%`;
}

function formatSemitoneOffset(value: number) {
    const semitones = clamp(value, -2, 2);
    const prefix = semitones > 0 ? "+" : "";
    return `${prefix}${semitones.toFixed(2)} st`;
}

function formatPanEditingValue(value: number) {
    return String(Math.round(clamp(value, -1, 1) * 100));
}

function parsePanInput(text: string) {
    const normalizedText = String(text ?? "")
        .trim()
        .toLowerCase()
        .replace(/%/g, "")
        .replace(/\s+/g, "");

    if (!normalizedText) {
        return null;
    }

    const numericValue = Number.parseFloat(normalizedText);

    if (!Number.isFinite(numericValue)) {
        return null;
    }

    return numericValue / 100;
}

function formatEnvelopeTimeDisplay(seconds: number) {
    return seconds >= 1 ? `${seconds.toFixed(2)} s` : `${Math.round(seconds * 1000)} ms`;
}

function parseEnvelopeTimeInput(text: string, currentSeconds: number) {
    const normalizedText = String(text ?? "")
        .trim()
        .toLowerCase();

    if (!normalizedText) {
        return null;
    }

    const match = normalizedText.match(/^(-?\d+(?:\.\d+)?)\s*(ms|msec|milliseconds|s|sec|secs|second|seconds)?$/);

    if (!match) {
        return null;
    }

    const numericValue = Number(match[1]);

    if (!Number.isFinite(numericValue)) {
        return null;
    }

    const unit = match[2];

    if (unit === "ms" || unit === "msec" || unit === "milliseconds") {
        return numericValue / 1000;
    }

    if (unit === "s" || unit === "sec" || unit === "secs" || unit === "second" || unit === "seconds") {
        return numericValue;
    }

    if (currentSeconds < 1) {
        return numericValue >= 10 ? numericValue / 1000 : numericValue;
    }

    return numericValue;
}

function clamp(value: number, min: number, max: number) {
    return Math.min(Math.max(value, min), max);
}

function secondsToEnvelopeNormalized(seconds: number) {
    const clampedSeconds = clamp(seconds, ENVELOPE_TIME_MIN_SECONDS, ENVELOPE_TIME_MAX_SECONDS);
    const raw = Math.log(clampedSeconds / ENVELOPE_TIME_MIN_SECONDS) / Math.log(ENVELOPE_TIME_MAX_SECONDS / ENVELOPE_TIME_MIN_SECONDS);
    return clamp(Math.pow(clamp(raw, 0, 1), ENVELOPE_TIME_RESPONSE), 0, 1);
}

function normalizedToEnvelopeSeconds(normalized: number) {
    const raw = Math.pow(clamp(normalized, 0, 1), 1 / ENVELOPE_TIME_RESPONSE);
    return ENVELOPE_TIME_MIN_SECONDS * Math.pow(ENVELOPE_TIME_MAX_SECONDS / ENVELOPE_TIME_MIN_SECONDS, raw);
}

function envelopeSustainToY(sustain: number) {
    const plotHeight = ENVELOPE_VIEWBOX.height - ENVELOPE_VIEWBOX.top - ENVELOPE_VIEWBOX.bottom;
    return ENVELOPE_VIEWBOX.top + ((1 - clamp(sustain, 0, 1)) * plotHeight);
}

function envelopeYToSustain(y: number) {
    const plotHeight = ENVELOPE_VIEWBOX.height - ENVELOPE_VIEWBOX.top - ENVELOPE_VIEWBOX.bottom;
    return clamp(1 - ((y - ENVELOPE_VIEWBOX.top) / plotHeight), 0, 1);
}

function computeEnvelopeGeometry(envelope: NonNullable<ModulationMatrixSectionProps["selectedEnvelope"]>) {
    const plotWidth = ENVELOPE_VIEWBOX.width - ENVELOPE_VIEWBOX.left - ENVELOPE_VIEWBOX.right;
    const attackRegionWidth = plotWidth * 0.30;
    const decayRegionWidth = plotWidth * 0.28;
    const noteOffX = ENVELOPE_VIEWBOX.left + (plotWidth * ENVELOPE_NOTE_OFF_RATIO);
    const releaseRegionWidth = ENVELOPE_VIEWBOX.width - ENVELOPE_VIEWBOX.right - noteOffX;
    const attackX = ENVELOPE_VIEWBOX.left + (secondsToEnvelopeNormalized(envelope.attackSeconds) * attackRegionWidth);
    const decayRegionStart = ENVELOPE_VIEWBOX.left + attackRegionWidth;
    const decayX = decayRegionStart + (secondsToEnvelopeNormalized(envelope.decaySeconds) * decayRegionWidth);
    const sustainY = envelopeSustainToY(envelope.sustain);
    const releaseX = noteOffX + (secondsToEnvelopeNormalized(envelope.releaseSeconds) * releaseRegionWidth);

    return {
        noteOffX,
        attackRegionWidth,
        decayRegionStart,
        decayRegionWidth,
        releaseRegionWidth,
        attackX,
        decayX,
        sustainY,
        releaseX,
        plotWidth,
        plotHeight: ENVELOPE_VIEWBOX.height - ENVELOPE_VIEWBOX.top - ENVELOPE_VIEWBOX.bottom,
        plotBottom: ENVELOPE_VIEWBOX.height - ENVELOPE_VIEWBOX.bottom,
        plotTop: ENVELOPE_VIEWBOX.top,
        plotLeft: ENVELOPE_VIEWBOX.left,
        plotRight: ENVELOPE_VIEWBOX.width - ENVELOPE_VIEWBOX.right,
    };
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

function formatFrequencyHz(value: number) {
    const safeValue = Math.max(20, Number(value) || 0);

    if (safeValue >= 10_000) {
        return `${(safeValue / 1000).toFixed(1)} kHz`;
    }

    if (safeValue >= 1000) {
        return `${(safeValue / 1000).toFixed(2)} kHz`;
    }

    return `${Math.round(safeValue)} Hz`;
}

function frequencyHzToLogNormalized(value: number, minHz: number, maxHz: number) {
    const safeValue = clamp(value, minHz, maxHz);
    return Math.log(safeValue / minHz) / Math.log(maxHz / minHz);
}

function normalizedToLogFrequencyHz(normalized: number, minHz: number, maxHz: number) {
    return minHz * Math.pow(maxHz / minHz, clamp(normalized, 0, 1));
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

function DesktopEnvelopeEditor({
    selectedEnvelope,
    onEnvelopeChange,
}: {
    selectedEnvelope: NonNullable<ModulationMatrixSectionProps["selectedEnvelope"]>;
    onEnvelopeChange: ModulationMatrixSectionProps["onEnvelopeChange"];
}) {
    const svgRef = useRef<SVGSVGElement | null>(null);
    const [activeHandle, setActiveHandle] = useState<null | "attack" | "decay-sustain" | "release">(null);
    const [activePointerId, setActivePointerId] = useState<number | null>(null);

    const geometry = useMemo(() => computeEnvelopeGeometry(selectedEnvelope), [selectedEnvelope]);

    const envelopePath = useMemo(() => [
        `M ${geometry.plotLeft} ${geometry.plotBottom}`,
        `L ${geometry.attackX} ${geometry.plotTop}`,
        `L ${geometry.decayX} ${geometry.sustainY}`,
        `L ${geometry.noteOffX} ${geometry.sustainY}`,
        `L ${geometry.releaseX} ${geometry.plotBottom}`,
        `L ${geometry.plotRight} ${geometry.plotBottom}`,
    ].join(" "), [geometry]);

    const envelopeFillPath = useMemo(() => [
        `M ${geometry.plotLeft} ${geometry.plotBottom}`,
        `L ${geometry.attackX} ${geometry.plotTop}`,
        `L ${geometry.decayX} ${geometry.sustainY}`,
        `L ${geometry.noteOffX} ${geometry.sustainY}`,
        `L ${geometry.releaseX} ${geometry.plotBottom}`,
        `L ${geometry.plotRight} ${geometry.plotBottom}`,
        `L ${geometry.plotLeft} ${geometry.plotBottom}`,
        "Z",
    ].join(" "), [geometry]);

    const readStagePoint = useCallback((clientX: number, clientY: number) => {
        const svg = svgRef.current;

        if (!svg) {
            return null;
        }

        const rect = svg.getBoundingClientRect();

        if (rect.width <= 0 || rect.height <= 0) {
            return null;
        }

        const normalizedX = (clientX - rect.left) / rect.width;
        const normalizedY = (clientY - rect.top) / rect.height;

        return {
            x: normalizedX * ENVELOPE_VIEWBOX.width,
            y: normalizedY * ENVELOPE_VIEWBOX.height,
        };
    }, []);

    useEffect(() => {
        if (!activeHandle || activePointerId === null) {
            return;
        }

        const handlePointerMove = (event: PointerEvent) => {
            if (event.pointerId !== activePointerId) {
                return;
            }

            const point = readStagePoint(event.clientX, event.clientY);

            if (!point) {
                return;
            }

            if (activeHandle === "attack") {
                const normalized = clamp(
                    (point.x - geometry.plotLeft) / Math.max(1, geometry.attackRegionWidth),
                    0,
                    1,
                );
                onEnvelopeChange("attackSeconds", normalizedToEnvelopeSeconds(normalized));
                return;
            }

            if (activeHandle === "decay-sustain") {
                const normalizedDecay = clamp(
                    (point.x - geometry.decayRegionStart) / Math.max(1, geometry.decayRegionWidth),
                    0,
                    1,
                );
                onEnvelopeChange("decaySeconds", normalizedToEnvelopeSeconds(normalizedDecay));
                onEnvelopeChange("sustain", envelopeYToSustain(point.y));
                return;
            }

            const normalizedRelease = clamp(
                (point.x - geometry.noteOffX) / Math.max(1, geometry.releaseRegionWidth),
                0,
                1,
            );
            onEnvelopeChange("releaseSeconds", normalizedToEnvelopeSeconds(normalizedRelease));
        };

        const clearActiveDrag = () => {
            setActiveHandle(null);
            setActivePointerId(null);
        };

        window.addEventListener("pointermove", handlePointerMove);
        window.addEventListener("pointerup", clearActiveDrag);
        window.addEventListener("pointercancel", clearActiveDrag);

        return () => {
            window.removeEventListener("pointermove", handlePointerMove);
            window.removeEventListener("pointerup", clearActiveDrag);
            window.removeEventListener("pointercancel", clearActiveDrag);
        };
    }, [activeHandle, activePointerId, geometry, onEnvelopeChange, readStagePoint]);

    const beginHandleDrag = useCallback((
        handleName: "attack" | "decay-sustain" | "release",
        event: ReactPointerEvent<SVGCircleElement>,
    ) => {
        event.preventDefault();
        event.stopPropagation();
        setActiveHandle(handleName);
        setActivePointerId(event.pointerId);
    }, []);

    return (
        <div className="relative h-full overflow-hidden bg-[linear-gradient(180deg,rgba(255,255,255,0.02),rgba(255,255,255,0.01)),linear-gradient(180deg,rgba(5,9,19,0.92),rgba(7,13,24,0.96))]">
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_18%_22%,rgba(109,216,255,0.10),transparent_26%),radial-gradient(circle_at_82%_78%,rgba(248,184,77,0.10),transparent_20%)]" />
                <svg
                    ref={svgRef}
                    viewBox={`0 0 ${ENVELOPE_VIEWBOX.width} ${ENVELOPE_VIEWBOX.height}`}
                    className="relative z-10 block h-full w-full touch-none"
                    data-role="adsr-editor-surface"
                    aria-label="Envelope editor"
                >
                    {Array.from({ length: 9 }, (_, step) => {
                        const x = geometry.plotLeft + ((geometry.plotWidth * step) / 8);
                        return (
                            <line
                                key={`env-grid-x-${step}`}
                                x1={x}
                                y1={geometry.plotTop}
                                x2={x}
                                y2={geometry.plotBottom}
                                stroke="rgba(145,163,199,0.12)"
                            />
                        );
                    })}
                    {Array.from({ length: 5 }, (_, step) => {
                        const y = geometry.plotTop + ((geometry.plotHeight * step) / 4);
                        return (
                            <line
                                key={`env-grid-y-${step}`}
                                x1={geometry.plotLeft}
                                y1={y}
                                x2={geometry.plotRight}
                                y2={y}
                                stroke="rgba(145,163,199,0.12)"
                            />
                        );
                    })}

                    <rect
                        x={geometry.plotLeft}
                        y={geometry.plotTop}
                        width={geometry.attackRegionWidth}
                        height={geometry.plotHeight}
                        rx={16}
                        fill="rgba(109,216,255,0.03)"
                    />
                    <rect
                        x={geometry.decayRegionStart}
                        y={geometry.plotTop}
                        width={geometry.decayRegionWidth}
                        height={geometry.plotHeight}
                        rx={16}
                        fill="rgba(109,216,255,0.045)"
                    />
                    <rect
                        x={geometry.noteOffX}
                        y={geometry.plotTop}
                        width={geometry.releaseRegionWidth}
                        height={geometry.plotHeight}
                        rx={16}
                        fill="rgba(248,184,77,0.04)"
                    />

                    <line
                        x1={geometry.noteOffX}
                        y1={geometry.plotTop}
                        x2={geometry.noteOffX}
                        y2={geometry.plotBottom}
                        stroke="rgba(248,184,77,0.84)"
                        strokeWidth={2}
                        strokeDasharray="7 7"
                    />

                    <path d={envelopeFillPath} fill="rgba(109,216,255,0.10)" />
                    <path
                        d={envelopePath}
                        fill="none"
                        stroke="rgba(109,216,255,0.98)"
                        strokeWidth={4}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                    />

                    <circle
                        cx={geometry.attackX}
                        cy={geometry.plotTop}
                        r={13}
                        fill="rgba(8,16,28,0.94)"
                        stroke="rgba(109,216,255,0.98)"
                        strokeWidth={3}
                    />
                    <circle cx={geometry.attackX} cy={geometry.plotTop} r={4} fill="rgba(109,216,255,0.98)" />
                    <circle
                        data-role="adsr-attack-handle-hit-target"
                        cx={geometry.attackX}
                        cy={geometry.plotTop}
                        r={34}
                        fill="transparent"
                        className="cursor-ew-resize"
                        onPointerDown={(event) => beginHandleDrag("attack", event)}
                    />

                    <circle
                        cx={geometry.decayX}
                        cy={geometry.sustainY}
                        r={13}
                        fill="rgba(8,16,28,0.94)"
                        stroke="rgba(248,184,77,0.98)"
                        strokeWidth={3}
                    />
                    <circle cx={geometry.decayX} cy={geometry.sustainY} r={4} fill="rgba(248,184,77,0.98)" />
                    <circle
                        data-role="adsr-decay-sustain-handle-hit-target"
                        cx={geometry.decayX}
                        cy={geometry.sustainY}
                        r={34}
                        fill="transparent"
                        className="cursor-move"
                        onPointerDown={(event) => beginHandleDrag("decay-sustain", event)}
                    />

                    <circle
                        cx={geometry.releaseX}
                        cy={geometry.plotBottom}
                        r={13}
                        fill="rgba(8,16,28,0.94)"
                        stroke="rgba(109,216,255,0.98)"
                        strokeWidth={3}
                    />
                    <circle cx={geometry.releaseX} cy={geometry.plotBottom} r={4} fill="rgba(109,216,255,0.98)" />
                    <circle
                        data-role="adsr-release-handle-hit-target"
                        cx={geometry.releaseX}
                        cy={geometry.plotBottom}
                        r={34}
                        fill="transparent"
                        className="cursor-ew-resize"
                        onPointerDown={(event) => beginHandleDrag("release", event)}
                    />
                </svg>
        </div>
    );
}

function StatusHeader({ statusText }: HeaderProps) {
    return (
        <header className="flex items-center justify-between gap-3">
            <span className="text-[10px] font-semibold uppercase tracking-[0.24em] text-blue-300/55">Cosimo Synth</span>
            <span className="text-[10px] uppercase tracking-[0.16em] text-fuchsia-200/60">{statusText}</span>
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

function DistortionSection({
    distortionMode,
    distortionDriveDb,
    distortionKnee,
    distortionWet,
    distortionWetHPHz,
    distortionWetLPHz,
    observedDistortionHistory,
    observedDistortionScope,
    className,
}: DistortionSectionProps) {
    const distortionModeOption = DISTORTION_MODE_OPTIONS.find((option) => option.value === distortionMode.value)
        ?? DISTORTION_MODE_OPTIONS[0];
    const inputPeak = observedDistortionScope?.inputPeak ?? 0;
    const outputPeak = observedDistortionScope?.outputPeak ?? 0;
    const removedPeak = observedDistortionScope?.removedPeak ?? 0;
    const overshoot = Math.max(0, inputPeak - 1);
    const headroom = Math.max(0, 1 - inputPeak);
    const wetHPNormalized = frequencyHzToLogNormalized(
        distortionWetHPHz.value,
        DISTORTION_WET_HP_MIN_HZ,
        DISTORTION_WET_HP_MAX_HZ,
    );
    const wetLPNormalized = frequencyHzToLogNormalized(
        distortionWetLPHz.value,
        DISTORTION_WET_LP_MIN_HZ,
        DISTORTION_WET_LP_MAX_HZ,
    );

    const handleWetHPChange = useCallback((nextNormalized: number) => {
        const nextValue = clamp(
            normalizedToLogFrequencyHz(nextNormalized, DISTORTION_WET_HP_MIN_HZ, DISTORTION_WET_HP_MAX_HZ),
            DISTORTION_WET_HP_MIN_HZ,
            Math.min(DISTORTION_WET_HP_MAX_HZ, distortionWetLPHz.value),
        );
        distortionWetHPHz.setValue(nextValue);
    }, [distortionWetHPHz, distortionWetLPHz.value]);

    const handleWetLPChange = useCallback((nextNormalized: number) => {
        const nextValue = clamp(
            normalizedToLogFrequencyHz(nextNormalized, DISTORTION_WET_LP_MIN_HZ, DISTORTION_WET_LP_MAX_HZ),
            Math.max(DISTORTION_WET_LP_MIN_HZ, distortionWetHPHz.value),
            DISTORTION_WET_LP_MAX_HZ,
        );
        distortionWetLPHz.setValue(nextValue);
    }, [distortionWetHPHz.value, distortionWetLPHz]);

    const normalizedDrive = distortionDriveDb.value / 36;
    const normalizedKnee = distortionKnee.value;
    const normalizedMix = distortionWet.value;

    const driveTrackRef = useRef<HTMLDivElement>(null);
    const kneeTrackRef = useRef<HTMLDivElement>(null);
    const mixTrackRef = useRef<HTMLDivElement>(null);
    const hpTrackRef = useRef<HTMLDivElement>(null);
    const dragRef = useRef<{
        pointerId: number;
        startClientY: number;
        startClientX: number;
        startNormalized: number;
        binding: PatchControlBinding<number>;
        axis: "vertical" | "horizontal";
        min: number;
        max: number;
        trackElement: HTMLDivElement;
        onChange?: (normalized: number) => void;
    } | null>(null);

    const handleSliderPointerDown = useCallback((
        event: ReactPointerEvent<HTMLDivElement>,
        trackElement: HTMLDivElement | null,
        binding: PatchControlBinding<number>,
        currentNormalized: number,
        min: number,
        max: number,
        axis: "vertical" | "horizontal",
        onChange?: (normalized: number) => void,
    ) => {
        if (!trackElement) return;
        event.preventDefault();
        trackElement.setPointerCapture(event.pointerId);
        binding.beginGesture();
        dragRef.current = {
            pointerId: event.pointerId,
            startClientY: event.clientY,
            startClientX: event.clientX,
            startNormalized: currentNormalized,
            binding,
            axis,
            min,
            max,
            trackElement,
            onChange,
        };
    }, []);

    const handleSliderPointerMove = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
        const drag = dragRef.current;
        if (!drag || event.pointerId !== drag.pointerId) return;
        const rect = drag.trackElement.getBoundingClientRect();
        let nextNormalized: number;
        if (drag.axis === "vertical") {
            const deltaY = drag.startClientY - event.clientY;
            const trackHeight = rect.height;
            nextNormalized = clamp(drag.startNormalized + (deltaY / trackHeight), 0, 1);
        } else {
            const deltaX = event.clientX - rect.left;
            nextNormalized = clamp(deltaX / rect.width, 0, 1);
        }
        if (drag.onChange) {
            drag.onChange(nextNormalized);
        } else {
            const denormalized = drag.min + (nextNormalized * (drag.max - drag.min));
            drag.binding.setValue(denormalized);
        }
    }, []);

    const handleSliderPointerUp = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
        const drag = dragRef.current;
        if (!drag || event.pointerId !== drag.pointerId) return;
        drag.trackElement.releasePointerCapture(event.pointerId);
        drag.binding.endGesture();
        dragRef.current = null;
    }, []);

    return (
        <section
            data-role="distortion-card"
            className={`flex h-full flex-col overflow-hidden rounded-[14px] bg-[radial-gradient(circle_at_top_left,rgba(248,113,113,0.10),transparent_34%),linear-gradient(180deg,rgba(9,8,15,0.98),rgba(2,4,11,1))] ${className ?? ""}`}
        >
            <input
                data-role="distortion-drive-field"
                type="range"
                min={0}
                max={36}
                step={0.001}
                value={distortionDriveDb.value}
                className="sr-only"
                tabIndex={-1}
                onInput={(event) => distortionDriveDb.setValue(Number(event.currentTarget.value))}
                onChange={(event) => distortionDriveDb.setValue(Number(event.currentTarget.value))}
            />
            <input
                data-role="distortion-mix-field"
                type="range"
                min={0}
                max={1}
                step={0.001}
                value={distortionWet.value}
                className="sr-only"
                tabIndex={-1}
                onInput={(event) => distortionWet.setValue(Number(event.currentTarget.value))}
                onChange={(event) => distortionWet.setValue(Number(event.currentTarget.value))}
            />
            <input
                data-role="distortion-wet-lp-field"
                type="range"
                min={0}
                max={1}
                step={0.001}
                value={wetLPNormalized}
                className="sr-only"
                tabIndex={-1}
                onInput={(event) => handleWetLPChange(Number(event.currentTarget.value))}
                onChange={(event) => handleWetLPChange(Number(event.currentTarget.value))}
            />
            <div className="flex min-h-0 flex-1">
                {/* Drive slider */}
                <div
                    className="flex w-7 shrink-0 flex-col items-center gap-1 py-2"
                >
                    <span className="text-[8px] font-bold uppercase tracking-[0.1em] text-slate-400/45">Drv</span>
                    <div
                        ref={driveTrackRef}
                        className="relative w-1.5 flex-1 cursor-ns-resize rounded-full bg-white/[0.04]"
                        onPointerDown={(e) => handleSliderPointerDown(e, driveTrackRef.current, distortionDriveDb, normalizedDrive, 0, 36, "vertical")}
                        onPointerMove={handleSliderPointerMove}
                        onPointerUp={handleSliderPointerUp}
                    >
                        <div
                            data-role="distortion-drive-fill"
                            className="cosimo-distortion-drive-fill absolute bottom-0 left-0 right-0 rounded-full"
                            style={{ height: `${normalizedDrive * 100}%` }}
                        />
                        <div
                            data-role="distortion-drive-handle"
                            className="cosimo-distortion-drive-handle absolute left-1/2 size-3.5 -translate-x-1/2 translate-y-1/2 rounded-full border-2 border-[rgba(3,5,12,0.7)]"
                            style={{ bottom: `${normalizedDrive * 100}%` }}
                        />
                    </div>
                    <span className="font-mono text-[8px] tracking-[0.04em] text-slate-200/55">{distortionDriveDb.value.toFixed(1)}</span>
                </div>

                {/* Knee slider */}
                <div
                    className="flex w-7 shrink-0 flex-col items-center gap-1 py-2"
                >
                    <span className="text-[8px] font-bold uppercase tracking-[0.1em] text-slate-400/45">Kne</span>
                    <div
                        ref={kneeTrackRef}
                        className="relative w-1.5 flex-1 cursor-ns-resize rounded-full bg-white/[0.04]"
                        onPointerDown={(e) => handleSliderPointerDown(e, kneeTrackRef.current, distortionKnee, normalizedKnee, 0, 1, "vertical")}
                        onPointerMove={handleSliderPointerMove}
                        onPointerUp={handleSliderPointerUp}
                    >
                        <div
                            data-role="distortion-knee-fill"
                            className="cosimo-distortion-knee-fill absolute bottom-0 left-0 right-0 rounded-full"
                            style={{ height: `${normalizedKnee * 100}%` }}
                        />
                        <div
                            data-role="distortion-knee-handle"
                            className="cosimo-distortion-knee-handle absolute left-1/2 size-3.5 -translate-x-1/2 translate-y-1/2 rounded-full border-2 border-[rgba(3,5,12,0.7)]"
                            style={{ bottom: `${normalizedKnee * 100}%` }}
                        />
                    </div>
                    <span className="font-mono text-[8px] tracking-[0.04em] text-slate-200/55">{formatUnitPercent(distortionKnee.value)}</span>
                </div>

                {/* Center: SVG + overlays */}
                <div className="relative min-h-0 min-w-0 flex-1">
                    <DistortionVisualizer
                        compact
                        knee={distortionKnee.value}
                        transferFrame={observedDistortionScope}
                        historyFrame={observedDistortionHistory}
                    />

                    {/* Top-left overlay: DIST label + mode toggle */}
                    <div className="absolute left-3 top-2 flex items-center gap-2">
                        <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-rose-400/40">Dist</span>
                        <button
                            data-role="distortion-mode-option-1"
                            type="button"
                            className={`rounded px-1.5 py-0.5 text-[8px] font-semibold uppercase tracking-[0.08em] transition ${
                                distortionMode.value === 0
                                    ? "bg-white/[0.06] text-slate-300/60"
                                    : "bg-cyan-400/10 text-cyan-300/70"
                            }`}
                            onClick={() => distortionMode.commitValue(distortionMode.value === 0 ? 1 : 0)}
                        >
                            {distortionModeOption.label}
                        </button>
                    </div>

                    {/* Bottom-right overlay: peak readouts */}
                    <div className="absolute bottom-5 right-2 grid gap-0.5 rounded-[5px] bg-black/50 px-2 py-1.5">
                        <span className="font-mono text-[8px] text-slate-200/55">In <span className="text-slate-200/85">{inputPeak.toFixed(3)}</span></span>
                        <span className="font-mono text-[8px] text-cyan-400/45">Out <span className="text-cyan-400/80">{outputPeak.toFixed(3)}</span></span>
                        <span className="font-mono text-[8px] text-rose-400/45">Rem <span className="text-rose-400/80">{removedPeak.toFixed(3)}</span></span>
                    </div>

                    {/* Bottom strip: HP/LP frequency range selector */}
                    <div
                        ref={hpTrackRef}
                        className="absolute bottom-1 left-3 right-3 h-3.5"
                        onPointerMove={handleSliderPointerMove}
                        onPointerUp={handleSliderPointerUp}
                    >
                        <div className="absolute inset-0 rounded bg-white/[0.02]" />
                        <div
                            className="absolute bottom-0 left-0 top-0 rounded-l bg-rose-400/[0.035]"
                            style={{ width: `${wetHPNormalized * 100}%` }}
                        />
                        <div
                            className="absolute bottom-0 top-0 bg-cyan-400/[0.08]"
                            style={{ left: `${wetHPNormalized * 100}%`, right: `${(1 - wetLPNormalized) * 100}%` }}
                        />
                        <div
                            className="absolute bottom-0 right-0 top-0 rounded-r bg-rose-400/[0.035]"
                            style={{ width: `${(1 - wetLPNormalized) * 100}%` }}
                        />
                        <div
                            className="absolute top-1/2 size-[11px] -translate-x-1/2 -translate-y-1/2 cursor-ew-resize rounded-full border-2 border-[#020611] bg-cyan-400/60"
                            style={{ left: `${wetHPNormalized * 100}%` }}
                            onPointerDown={(e) => handleSliderPointerDown(e, hpTrackRef.current, distortionWetHPHz, wetHPNormalized, 0, 1, "horizontal", handleWetHPChange)}
                        />
                        <div
                            className="absolute top-1/2 size-[11px] -translate-x-1/2 -translate-y-1/2 cursor-ew-resize rounded-full border-2 border-[#020611] bg-cyan-400/60"
                            style={{ left: `${wetLPNormalized * 100}%` }}
                            onPointerDown={(e) => handleSliderPointerDown(e, hpTrackRef.current, distortionWetLPHz, wetLPNormalized, 0, 1, "horizontal", handleWetLPChange)}
                        />
                        <span
                            className="absolute -top-3 -translate-x-1/2 font-mono text-[7px] text-cyan-400/45"
                            style={{ left: `${wetHPNormalized * 100}%` }}
                        >
                            {formatFrequencyHz(distortionWetHPHz.value)}
                        </span>
                        <span
                            className="absolute -top-3 -translate-x-1/2 font-mono text-[7px] text-cyan-400/45"
                            style={{ left: `${wetLPNormalized * 100}%` }}
                        >
                            {formatFrequencyHz(distortionWetLPHz.value)}
                        </span>
                    </div>
                </div>

                {/* Mix slider */}
                <div
                    className="flex w-7 shrink-0 flex-col items-center gap-1 py-2"
                >
                    <span className="text-[8px] font-bold uppercase tracking-[0.1em] text-slate-400/45">Mix</span>
                    <div
                        ref={mixTrackRef}
                        className="relative w-1.5 flex-1 cursor-ns-resize rounded-full bg-white/[0.04]"
                        onPointerDown={(e) => handleSliderPointerDown(e, mixTrackRef.current, distortionWet, normalizedMix, 0, 1, "vertical")}
                        onPointerMove={handleSliderPointerMove}
                        onPointerUp={handleSliderPointerUp}
                    >
                        <div
                            data-role="distortion-mix-fill"
                            className="cosimo-distortion-mix-fill absolute bottom-0 left-0 right-0 rounded-full"
                            style={{ height: `${normalizedMix * 100}%` }}
                        />
                        <div
                            data-role="distortion-mix-handle"
                            className="cosimo-distortion-mix-handle absolute left-1/2 size-3.5 -translate-x-1/2 translate-y-1/2 rounded-full border-2 border-[rgba(3,5,12,0.7)]"
                            style={{ bottom: `${normalizedMix * 100}%` }}
                        />
                    </div>
                    <span className="font-mono text-[8px] tracking-[0.04em] text-slate-200/55">{formatUnitPercent(distortionWet.value)}</span>
                </div>
            </div>
        </section>
    );
}

function ChorusRangeControl({
    label,
    binding,
    dataRole,
    min = 0,
    max = 1,
    step = 0.001,
    formatValue = formatUnitPercent,
}: {
    label: string;
    binding: PatchControlBinding<number>;
    dataRole: string;
    min?: number;
    max?: number;
    step?: number;
    formatValue?: (value: number) => string;
}) {
    const value = clamp(Number(binding.value) || 0, min, max);
    const isGestureActiveRef = useRef(false);
    const interactionRef = useRef<{
        pointerId?: number;
        removeListeners?: () => void;
        source: "keyboard" | "pointer";
        target: HTMLInputElement;
    } | null>(null);

    const endGesture = useCallback((target?: HTMLInputElement, pointerId?: number) => {
        const interaction = interactionRef.current;

        if (!interaction || !isGestureActiveRef.current) {
            return;
        }

        if (
            pointerId !== undefined
            && interaction.pointerId !== undefined
            && pointerId !== interaction.pointerId
        ) {
            return;
        }

        interaction.removeListeners?.();

        if (target && pointerId !== undefined && target.hasPointerCapture(pointerId)) {
            try {
                target.releasePointerCapture(pointerId);
            } catch {
                // Synthetic pointer events in tests do not always own browser pointer capture.
            }
        }

        isGestureActiveRef.current = false;
        interactionRef.current = null;
        binding.endGesture();
    }, [binding]);

    const beginPointerGesture = useCallback((event: ReactPointerEvent<HTMLInputElement>) => {
        const target = event.currentTarget;
        const pointerId = event.pointerId;

        endGesture();
        isGestureActiveRef.current = true;
        interactionRef.current = {
            pointerId,
            source: "pointer",
            target,
        };
        binding.beginGesture();

        const endForPointer = (nextEvent: PointerEvent) => {
            endGesture(target, nextEvent.pointerId);
        };
        const endForMouse = () => {
            endGesture(target, pointerId);
        };
        const endIfButtonsReleased = (nextEvent: PointerEvent | MouseEvent) => {
            if (nextEvent.buttons === 0) {
                endGesture(target, pointerId);
            }
        };

        window.addEventListener("pointerup", endForPointer, true);
        window.addEventListener("pointercancel", endForPointer, true);
        window.addEventListener("pointermove", endIfButtonsReleased, true);
        window.addEventListener("mouseup", endForMouse, true);
        window.addEventListener("mousemove", endIfButtonsReleased, true);
        window.addEventListener("blur", endForMouse);

        if (interactionRef.current) {
            interactionRef.current.removeListeners = () => {
                window.removeEventListener("pointerup", endForPointer, true);
                window.removeEventListener("pointercancel", endForPointer, true);
                window.removeEventListener("pointermove", endIfButtonsReleased, true);
                window.removeEventListener("mouseup", endForMouse, true);
                window.removeEventListener("mousemove", endIfButtonsReleased, true);
                window.removeEventListener("blur", endForMouse);
            };
        }
    }, [binding, endGesture]);

    const beginKeyboardGesture = useCallback((target: HTMLInputElement) => {
        if (interactionRef.current) {
            return;
        }

        isGestureActiveRef.current = true;
        interactionRef.current = {
            source: "keyboard",
            target,
        };
        binding.beginGesture();
    }, [binding]);

    const handleRangeInput = useCallback((event: ReactFormEvent<HTMLInputElement>) => {
        binding.setValue(Number(event.currentTarget.value));
    }, [binding]);

    useEffect(() => () => endGesture(), [endGesture]);

    return (
        <label className="grid gap-1">
            <span className="flex items-center justify-between text-[8px] font-bold uppercase tracking-[0.10em] text-slate-300/45">
                <span>{label}</span>
                <span className="font-mono text-[8px] font-normal tracking-[0.03em] text-cyan-100/55">{formatValue(value)}</span>
            </span>
            <input
                data-role={dataRole}
                type="range"
                min={min}
                max={max}
                step={step}
                value={value}
                className="h-1.5 w-full cursor-ew-resize accent-cyan-300"
                onPointerDown={beginPointerGesture}
                onPointerMove={(event) => {
                    if (interactionRef.current?.source === "pointer" && event.buttons === 0) {
                        endGesture(event.currentTarget, event.pointerId);
                    }
                }}
                onPointerUp={(event) => endGesture(event.currentTarget, event.pointerId)}
                onPointerCancel={(event) => endGesture(event.currentTarget, event.pointerId)}
                onLostPointerCapture={(event) => endGesture(event.currentTarget, event.pointerId)}
                onMouseMove={(event) => {
                    if (interactionRef.current?.source === "pointer" && event.buttons === 0) {
                        endGesture(event.currentTarget);
                    }
                }}
                onMouseUp={(event) => endGesture(event.currentTarget)}
                onKeyDown={(event) => {
                    if (["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Home", "End", "PageUp", "PageDown"].includes(event.key)) {
                        beginKeyboardGesture(event.currentTarget);
                    }
                }}
                onKeyUp={(event) => {
                    if (interactionRef.current?.source === "keyboard") {
                        endGesture(event.currentTarget);
                    }
                }}
                onBlur={() => endGesture()}
                onInput={handleRangeInput}
                onChange={handleRangeInput}
            />
        </label>
    );
}

function ChorusModeIcon({ kind }: { kind: "motion" | "bloom" | "pitch" }) {
    if (kind === "motion") {
        return (
            <svg viewBox="0 0 24 24" aria-hidden="true" className="size-[15px] fill-none stroke-current stroke-[1.8]">
                <path d="M3.5 13.5 C6 7.5, 9 7.5, 11.5 13.5 S17 19.5, 20.5 13.5" strokeLinecap="round" />
                <path d="M3.5 10.5 C6 16.5, 9 16.5, 11.5 10.5 S17 4.5, 20.5 10.5" strokeLinecap="round" opacity="0.45" />
            </svg>
        );
    }

    if (kind === "bloom") {
        return (
            <svg viewBox="0 0 24 24" aria-hidden="true" className="size-[15px] fill-none stroke-current stroke-[1.7]">
                <circle cx="12" cy="12" r="3.1" />
                <path d="M12 3.5 V6.2 M12 17.8 V20.5 M3.5 12 H6.2 M17.8 12 H20.5" strokeLinecap="round" />
                <path d="M5.7 5.7 L7.6 7.6 M16.4 16.4 L18.3 18.3 M18.3 5.7 L16.4 7.6 M7.6 16.4 L5.7 18.3" strokeLinecap="round" opacity="0.55" />
            </svg>
        );
    }

    return (
        <svg viewBox="0 0 24 24" aria-hidden="true" className="size-[15px] fill-none stroke-current stroke-[1.7]">
            <path d="M6.5 17.5 V6.5 H9.5 L15.5 17.5 H18.5 V6.5" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M8 12 H16" strokeLinecap="round" opacity="0.5" />
        </svg>
    );
}

function ChorusModeButton({
    label,
    value,
    icon,
    dataRole,
    onClick,
}: {
    label: string;
    value: string;
    icon: "motion" | "bloom" | "pitch";
    dataRole: string;
    onClick: () => void;
}) {
    return (
        <button
            data-role={dataRole}
            type="button"
            aria-label={`${label}: ${value}. Click to cycle.`}
            title={`${label}: ${value}`}
            className="group relative flex h-[21px] min-w-0 items-center gap-1.5 overflow-hidden rounded-[8px] border border-cyan-200/[0.10] bg-[linear-gradient(180deg,rgba(16,27,43,0.82),rgba(3,7,17,0.96))] px-1.5 text-left shadow-[inset_0_1px_0_rgba(255,255,255,0.075),0_8px_16px_rgba(0,0,0,0.12)] transition duration-200 hover:-translate-y-px hover:border-cyan-200/25 hover:bg-cyan-200/[0.055] active:translate-y-0 active:scale-[0.99]"
            onClick={onClick}
        >
            <span className="pointer-events-none absolute inset-x-2 top-0 h-px bg-gradient-to-r from-transparent via-cyan-200/35 to-transparent opacity-70" />
            <span className="grid size-[16px] shrink-0 place-items-center rounded-[6px] border border-white/[0.06] bg-white/[0.035] text-cyan-100/65 transition group-hover:text-cyan-100/90">
                <ChorusModeIcon kind={icon} />
            </span>
            <span className="shrink-0 text-[7px] font-black uppercase leading-none tracking-[0.11em] text-slate-300/45">
                {label}
            </span>
            <span className="ml-auto shrink-0 whitespace-nowrap font-mono text-[8px] font-black uppercase leading-none tracking-[0.035em] text-cyan-50/82 transition group-hover:text-cyan-50">
                {value}
            </span>
        </button>
    );
}

function ChorusEffectColumn({
    chorusEnabled,
    chorusMix,
    chorusMotionMode,
    chorusBloomMode,
    chorusTone,
    chorusFeedback,
    chorusRingAmount,
    chorusRingOffsetMode,
    chorusRingFineSemitones,
}: ChorusEffectColumnProps) {
    const motionIndex = clamp(Math.round(Number(chorusMotionMode.value) || 0), 0, CHORUS_MOTION_MODE_OPTIONS.length - 1);
    const bloomIndex = clamp(Math.round(Number(chorusBloomMode.value) || 0), 0, CHORUS_BLOOM_MODE_OPTIONS.length - 1);
    const ringOffsetIndex = clamp(Math.round(Number(chorusRingOffsetMode.value) || 0), 0, CHORUS_RING_OFFSET_MODE_OPTIONS.length - 1);
    const enabled = Math.round(Number(chorusEnabled.value) || 0) === 1;

    return (
        <section
            data-role="chorus-effect-column"
            className="flex h-full min-w-0 flex-col gap-2 rounded-[12px] border border-cyan-300/[0.08] bg-[radial-gradient(circle_at_top_left,rgba(103,232,249,0.13),transparent_38%),linear-gradient(180deg,rgba(6,12,24,0.95),rgba(2,5,12,0.98))] p-3"
        >
            <div className="flex items-center justify-between gap-2">
                <span className="text-[10px] font-black uppercase tracking-[0.18em] text-cyan-100/75">Chorus</span>
                <button
                    data-role="chorus-enabled-control"
                    type="button"
                    className={`rounded-[7px] border px-2 py-1 text-[8px] font-bold uppercase tracking-[0.12em] transition ${
                        enabled
                            ? "border-cyan-300/25 bg-cyan-300/15 text-cyan-50"
                            : "border-white/[0.07] bg-white/[0.025] text-slate-400/70"
                    }`}
                    onClick={() => chorusEnabled.commitValue(enabled ? 0 : 1)}
                >
                    {enabled ? "On" : "Off"}
                </button>
            </div>

            <div className="grid gap-2">
                <ChorusRangeControl label="Mix" binding={chorusMix} dataRole="chorus-mix-control" />
                <div className="grid min-w-0 gap-1">
                    <ChorusModeButton
                        label="Motion"
                        value={CHORUS_MOTION_MODE_OPTIONS[motionIndex]}
                        icon="motion"
                        dataRole="chorus-motion-mode-control"
                        onClick={() => chorusMotionMode.commitValue((motionIndex + 1) % CHORUS_MOTION_MODE_OPTIONS.length)}
                    />
                    <ChorusModeButton
                        label="Bloom"
                        value={CHORUS_BLOOM_MODE_OPTIONS[bloomIndex]}
                        icon="bloom"
                        dataRole="chorus-bloom-mode-control"
                        onClick={() => chorusBloomMode.commitValue((bloomIndex + 1) % CHORUS_BLOOM_MODE_OPTIONS.length)}
                    />
                    <ChorusModeButton
                        label="Pitch"
                        value={CHORUS_RING_OFFSET_MODE_OPTIONS[ringOffsetIndex]}
                        icon="pitch"
                        dataRole="chorus-ring-offset-mode-control"
                        onClick={() => chorusRingOffsetMode.commitValue((ringOffsetIndex + 1) % CHORUS_RING_OFFSET_MODE_OPTIONS.length)}
                    />
                </div>
                <ChorusRangeControl label="Tone" binding={chorusTone} dataRole="chorus-tone-control" />
                <ChorusRangeControl label="Fdbk" binding={chorusFeedback} dataRole="chorus-feedback-control" />
                <ChorusRangeControl label="Ring" binding={chorusRingAmount} dataRole="chorus-ring-amount-control" />
                <ChorusRangeControl
                    label="Fine"
                    binding={chorusRingFineSemitones}
                    dataRole="chorus-ring-fine-control"
                    min={-2}
                    max={2}
                    step={0.001}
                    formatValue={formatSemitoneOffset}
                />
            </div>
        </section>
    );
}

function ReservedEffectColumn({ label }: { label: string }) {
    return (
        <div
            data-role="effect-rack-column"
            className="flex h-full min-w-0 items-center justify-center rounded-[12px] border border-dashed border-white/[0.06] bg-white/[0.012] text-[9px] font-bold uppercase tracking-[0.16em] text-slate-500/35"
        >
            {label}
        </div>
    );
}

function EffectsRackSection({
    chorusEnabled,
    chorusMix,
    chorusMotionMode,
    chorusBloomMode,
    chorusTone,
    chorusFeedback,
    chorusRingAmount,
    chorusRingOffsetMode,
    chorusRingFineSemitones,
    className,
}: EffectsRackSectionProps) {
    return (
        <section
            data-role="effects-rack-card"
            className={`grid h-full grid-cols-4 gap-2 rounded-[14px] border border-white/[0.04] bg-[linear-gradient(135deg,rgba(8,16,30,0.96),rgba(4,6,14,1))] p-2 ${className ?? ""}`}
        >
            <div data-role="effect-rack-column" className="min-h-0 min-w-0">
                <ChorusEffectColumn
                    chorusEnabled={chorusEnabled}
                    chorusMix={chorusMix}
                    chorusMotionMode={chorusMotionMode}
                    chorusBloomMode={chorusBloomMode}
                    chorusTone={chorusTone}
                    chorusFeedback={chorusFeedback}
                    chorusRingAmount={chorusRingAmount}
                    chorusRingOffsetMode={chorusRingOffsetMode}
                    chorusRingFineSemitones={chorusRingFineSemitones}
                />
            </div>
            <ReservedEffectColumn label="FX 2" />
            <ReservedEffectColumn label="FX 3" />
            <ReservedEffectColumn label="FX 4" />
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
    selectedMsegSlot,
    msegState,
    observedMsegPlayhead,
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
    const [activeEditorTab, setActiveEditorTab] = useState<{
        kind: "mseg" | "envelope";
        slotIndex: number;
    }>({
        kind: "mseg",
        slotIndex: 0,
    });

    const activeMsegSlot = activeEditorTab.kind === "mseg" ? activeEditorTab.slotIndex : selectedMsegSlot;
    const activeEnvelopeSlot = activeEditorTab.kind === "envelope" ? activeEditorTab.slotIndex : selectedEnvelopeSlot;

    // MSEG rate drag/edit state
    const msegRateRef = useRef<HTMLInputElement | null>(null);
    const msegRateWheelCursorTimerRef = useRef<number>(0);
    const msegRateDragRef = useRef<{
        pointerId: number;
        startClientX: number;
        startValue: number;
        moved: boolean;
    } | null>(null);
    const [isEditingMsegRate, setIsEditingMsegRate] = useState(false);
    const [draftMsegRate, setDraftMsegRate] = useState("");

    const currentMsegRate = clampMsegRateSeconds(Number(msegState?.playback.rate.seconds ?? 1));

    useEffect(() => {
        const el = msegRateRef.current;
        if (!el) return;
        const timerRef = msegRateWheelCursorTimerRef;
        const handler = (event: WheelEvent) => {
            if (isEditingMsegRate) return;
            event.preventDefault();
            el.style.cursor = "none";
            clearTimeout(timerRef.current);
            timerRef.current = window.setTimeout(() => { el.style.cursor = ""; }, 400);
            const step = ((MSEG_RATE_MAX_SECONDS - MSEG_RATE_MIN_SECONDS) / 400) * (event.deltaY > 0 ? 1 : -1);
            onMsegRateChange(clamp(currentMsegRate + step, MSEG_RATE_MIN_SECONDS, MSEG_RATE_MAX_SECONDS));
        };
        el.addEventListener("wheel", handler, { passive: false });
        return () => el.removeEventListener("wheel", handler);
    }, [isEditingMsegRate, currentMsegRate, onMsegRateChange]);

    const commitMsegRateText = useCallback((text: string) => {
        const parsed = parseFloat(text);
        if (Number.isFinite(parsed)) {
            onMsegRateChange(clamp(parsed, MSEG_RATE_MIN_SECONDS, MSEG_RATE_MAX_SECONDS));
        }
        setIsEditingMsegRate(false);
    }, [onMsegRateChange]);

    // ADSR draft state (for envelope tab top-bar inputs)
    const [draftAttack, setDraftAttack] = useState("");
    const [draftDecay, setDraftDecay] = useState("");
    const [draftSustain, setDraftSustain] = useState("");
    const [draftRelease, setDraftRelease] = useState("");

    useEffect(() => {
        if (!selectedEnvelope) {
            return;
        }
        setDraftAttack(formatEnvelopeTimeDisplay(selectedEnvelope.attackSeconds));
        setDraftDecay(formatEnvelopeTimeDisplay(selectedEnvelope.decaySeconds));
        setDraftSustain((selectedEnvelope.sustain * 100).toFixed(1));
        setDraftRelease(formatEnvelopeTimeDisplay(selectedEnvelope.releaseSeconds));
    }, [
        selectedEnvelope?.attackSeconds,
        selectedEnvelope?.decaySeconds,
        selectedEnvelope?.releaseSeconds,
        selectedEnvelope?.sustain,
    ]);

    const commitEnvelopeDurationField = useCallback((
        field: "attackSeconds" | "decaySeconds" | "releaseSeconds",
        draftValue: string,
        currentSeconds: number,
    ) => {
        if (!selectedEnvelope) {
            return;
        }
        const parsedValue = parseEnvelopeTimeInput(draftValue, currentSeconds);
        if (parsedValue === null) {
            setDraftAttack(formatEnvelopeTimeDisplay(selectedEnvelope.attackSeconds));
            setDraftDecay(formatEnvelopeTimeDisplay(selectedEnvelope.decaySeconds));
            setDraftRelease(formatEnvelopeTimeDisplay(selectedEnvelope.releaseSeconds));
            return;
        }
        onEnvelopeChange(field, clamp(parsedValue, ENVELOPE_TIME_MIN_SECONDS, ENVELOPE_TIME_MAX_SECONDS));
    }, [onEnvelopeChange, selectedEnvelope]);

    const handleEnvelopeFieldKeyDown = useCallback((
        event: ReactKeyboardEvent<HTMLInputElement>,
        field: "attackSeconds" | "decaySeconds" | "releaseSeconds",
        draftValue: string,
        currentSeconds: number,
    ) => {
        if (!selectedEnvelope) {
            return;
        }
        if (event.key === "Enter") {
            event.preventDefault();
            commitEnvelopeDurationField(field, draftValue, currentSeconds);
            return;
        }
        if (event.key === "Escape") {
            event.preventDefault();
            if (field === "attackSeconds") {
                setDraftAttack(formatEnvelopeTimeDisplay(selectedEnvelope.attackSeconds));
            } else if (field === "decaySeconds") {
                setDraftDecay(formatEnvelopeTimeDisplay(selectedEnvelope.decaySeconds));
            } else {
                setDraftRelease(formatEnvelopeTimeDisplay(selectedEnvelope.releaseSeconds));
            }
            event.currentTarget.blur();
        }
    }, [commitEnvelopeDurationField, selectedEnvelope]);

    return (
        <section className={`flex h-full flex-col overflow-hidden rounded-[14px] bg-white/[0.02] ${DESKTOP_GRID_CARD_CLASS}`}>
            {/* ── Pip selector top-bar ── */}
            <div className="flex shrink-0 items-center gap-1.5 px-2.5 py-1.5">
                {/* MSEG pips */}
                <div className="flex gap-[3px]">
                    {Array.from({ length: MODULATION_MSEG_SLOT_COUNT }, (_, slotIndex) => (
                        <button
                            key={`mseg-pip-${slotIndex}`}
                            type="button"
                            aria-label={`Select MSEG ${slotIndex + 1}`}
                            className={`grid size-[18px] place-items-center rounded-[5px] border p-0 text-[8px] leading-none font-bold transition max-[480px]:size-7 max-[480px]:rounded-[6px] max-[480px]:text-[10px] ${
                                activeEditorTab.kind === "mseg" && activeMsegSlot === slotIndex
                                    ? "border-cyan-300/25 bg-cyan-300/15 text-cyan-50/90"
                                    : "border-white/[0.06] bg-white/[0.02] text-slate-300/40 hover:border-white/10 hover:text-slate-300/65"
                            }`}
                            onClick={() => {
                                onSelectMsegSlot(slotIndex);
                                setActiveEditorTab({ kind: "mseg", slotIndex });
                            }}
                        >
                            {slotIndex + 1}
                        </button>
                    ))}
                </div>
                <span className="ml-0.5 text-[10px] leading-none font-semibold uppercase tracking-[0.12em] text-cyan-100/60">Mseg</span>

                {/* Separator */}
                <div className="mx-0.5 h-3 w-px shrink-0 bg-white/[0.06]" />

                {/* ENV pips */}
                <div className="flex gap-[3px]">
                    {Array.from({ length: MODULATION_ENV_SLOT_COUNT }, (_, slotIndex) => (
                        <button
                            key={`env-pip-${slotIndex}`}
                            type="button"
                            aria-label={`Select envelope ${slotIndex + 1}`}
                            className={`grid size-[18px] place-items-center rounded-[5px] border p-0 text-[8px] leading-none font-bold transition max-[480px]:size-7 max-[480px]:rounded-[6px] max-[480px]:text-[10px] ${
                                activeEditorTab.kind === "envelope" && activeEnvelopeSlot === slotIndex
                                    ? "border-emerald-300/25 bg-emerald-300/12 text-emerald-100/90"
                                    : "border-white/[0.06] bg-white/[0.02] text-slate-300/40 hover:border-white/10 hover:text-slate-300/65"
                            }`}
                            onClick={() => {
                                onSelectEnvelopeSlot(slotIndex);
                                setActiveEditorTab({ kind: "envelope", slotIndex });
                            }}
                        >
                            {slotIndex + 1}
                        </button>
                    ))}
                </div>
                <span className="ml-0.5 text-[10px] leading-none font-semibold uppercase tracking-[0.12em] text-emerald-200/50">Env</span>

                {/* Right-aligned controls — fixed-height container, both layers always rendered */}
                <div className="relative ml-auto h-[22px] shrink-0 max-[480px]:h-7">
                    {/* MSEG controls */}
                    <div className={`absolute inset-0 flex items-center justify-end gap-2 ${activeEditorTab.kind === "mseg" ? "visible" : "invisible"}`}>
                        <button
                            type="button"
                            aria-label={msegState?.playback.loop ? "Looping" : "One Shot"}
                            className={`grid size-[22px] shrink-0 place-items-center rounded-[6px] border p-0 transition max-[480px]:size-7 ${
                                msegState?.playback.loop
                                    ? "border-cyan-300/20 bg-cyan-300/10"
                                    : "border-white/[0.06] bg-white/[0.02]"
                            }`}
                            onClick={onToggleMsegLoop}
                            tabIndex={activeEditorTab.kind === "mseg" ? 0 : -1}
                        >
                            <span className="sr-only">{msegState?.playback.loop ? "Looping" : "One Shot"}</span>
                            <svg
                                viewBox="0 0 16 16"
                                className={`size-3 fill-none stroke-[1.5] stroke-current max-[480px]:size-3.5 ${
                                    msegState?.playback.loop ? "text-cyan-300/85" : "text-slate-300/40"
                                }`}
                            >
                                <path d="M4 6 L12 6 L12 4 L15 7 L12 10 L12 8 L4 8 L4 10 L1 7 L4 4 Z" strokeLinecap="round" />
                            </svg>
                        </button>
                        <input
                            ref={msegRateRef}
                            type="text"
                            inputMode="decimal"
                            autoComplete="off"
                            spellCheck={false}
                            readOnly={!isEditingMsegRate}
                            aria-label="MSEG rate"
                            className={`w-[56px] select-none whitespace-nowrap rounded border border-white/[0.04] bg-white/[0.03] px-1.5 py-[3px] text-center font-mono text-[10px] leading-none tracking-[0.06em] text-cyan-200/70 outline-none max-[480px]:w-[64px] max-[480px]:px-2 max-[480px]:py-1 max-[480px]:text-[11px] ${
                                isEditingMsegRate
                                    ? "cursor-text selection:bg-cyan-300/25"
                                    : "cursor-ew-resize"
                            }`}
                            value={isEditingMsegRate ? draftMsegRate : formatSeconds(currentMsegRate)}
                            tabIndex={activeEditorTab.kind === "mseg" ? 0 : -1}
                            onPointerDown={(event) => {
                                if (event.button !== 0 || isEditingMsegRate) return;
                                msegRateDragRef.current = {
                                    pointerId: event.pointerId,
                                    startClientX: event.clientX,
                                    startValue: currentMsegRate,
                                    moved: false,
                                };
                                event.currentTarget.setPointerCapture(event.pointerId);
                                event.preventDefault();
                            }}
                            onPointerMove={(event) => {
                                const drag = msegRateDragRef.current;
                                if (!drag || drag.pointerId !== event.pointerId || isEditingMsegRate) return;
                                const deltaX = event.clientX - drag.startClientX;
                                if (Math.abs(deltaX) >= 2) drag.moved = true;
                                const range = MSEG_RATE_MAX_SECONDS - MSEG_RATE_MIN_SECONDS;
                                const scaled = (deltaX / 120) * range;
                                onMsegRateChange(clamp(drag.startValue + scaled, MSEG_RATE_MIN_SECONDS, MSEG_RATE_MAX_SECONDS));
                            }}
                            onPointerUp={(event) => {
                                const drag = msegRateDragRef.current;
                                if (!drag || drag.pointerId !== event.pointerId || isEditingMsegRate) return;
                                msegRateDragRef.current = null;
                                event.currentTarget.releasePointerCapture(event.pointerId);
                                if (!drag.moved) {
                                    setDraftMsegRate(currentMsegRate.toFixed(3));
                                    setIsEditingMsegRate(true);
                                    requestAnimationFrame(() => {
                                        msegRateRef.current?.focus();
                                        msegRateRef.current?.select();
                                    });
                                }
                            }}
                            onPointerCancel={(event) => {
                                const drag = msegRateDragRef.current;
                                if (!drag || drag.pointerId !== event.pointerId) return;
                                msegRateDragRef.current = null;
                                event.currentTarget.releasePointerCapture(event.pointerId);
                            }}
                            onChange={(event) => {
                                if (isEditingMsegRate) {
                                    setDraftMsegRate(event.currentTarget.value);
                                } else {
                                    commitMsegRateText(event.currentTarget.value);
                                }
                            }}
                            onInput={(event) => {
                                if (!isEditingMsegRate) {
                                    commitMsegRateText(event.currentTarget.value);
                                }
                            }}
                            onKeyDown={(event) => {
                                if (!isEditingMsegRate) {
                                    if (event.key === "Enter") { event.preventDefault(); setDraftMsegRate(currentMsegRate.toFixed(3)); setIsEditingMsegRate(true); }
                                    return;
                                }
                                if (event.key === "Enter") { event.preventDefault(); commitMsegRateText(draftMsegRate); msegRateRef.current?.blur(); }
                                if (event.key === "Escape") { event.preventDefault(); setIsEditingMsegRate(false); msegRateRef.current?.blur(); }
                            }}
                            onBlur={() => {
                                if (isEditingMsegRate) commitMsegRateText(draftMsegRate);
                            }}
                            {...msegRateFocusBindings}
                        />
                    </div>

                    {/* Envelope ADSR controls */}
                    <div className={`absolute inset-0 flex items-center justify-end gap-1.5 ${activeEditorTab.kind === "envelope" && selectedEnvelope ? "visible" : "invisible"}`}>
                        {selectedEnvelope ? ([
                            { label: "A", ariaLabel: "Envelope attack value", field: "attackSeconds" as const, draft: draftAttack, setDraft: setDraftAttack, current: selectedEnvelope.attackSeconds },
                            { label: "D", ariaLabel: "Envelope decay value", field: "decaySeconds" as const, draft: draftDecay, setDraft: setDraftDecay, current: selectedEnvelope.decaySeconds },
                            { label: "S", ariaLabel: "Envelope sustain value", field: null, draft: draftSustain, setDraft: setDraftSustain, current: selectedEnvelope.sustain },
                            { label: "R", ariaLabel: "Envelope release value", field: "releaseSeconds" as const, draft: draftRelease, setDraft: setDraftRelease, current: selectedEnvelope.releaseSeconds },
                        ] as const).map((param) => (
                            <label key={param.label} className="flex items-center gap-[3px]">
                                <span className="text-[9px] font-semibold uppercase text-slate-400/60">{param.label}</span>
                                <input
                                    aria-label={param.ariaLabel}
                                    type="text"
                                    inputMode="decimal"
                                    className="w-[38px] rounded border border-white/[0.06] bg-white/[0.03] px-1 py-[2px] text-left font-mono text-[9px] leading-none text-slate-200/80 outline-none focus:border-emerald-300/30 max-[480px]:w-[44px] max-[480px]:text-[10px]"
                                    value={param.draft}
                                    onChange={(e) => param.setDraft(e.target.value)}
                                    onBlur={() => {
                                        if (param.field) {
                                            commitEnvelopeDurationField(param.field, param.draft, param.current);
                                        } else {
                                            const parsed = parseFloat(param.draft);
                                            if (!Number.isFinite(parsed)) {
                                                param.setDraft((selectedEnvelope.sustain * 100).toFixed(1));
                                                return;
                                            }
                                            onEnvelopeChange("sustain", clamp(parsed / 100, 0, 1));
                                        }
                                    }}
                                    onKeyDown={(e) => {
                                        if (param.field) {
                                            handleEnvelopeFieldKeyDown(e, param.field, param.draft, param.current);
                                        } else if (e.key === "Enter") {
                                            e.preventDefault();
                                            const parsed = parseFloat(param.draft);
                                            if (Number.isFinite(parsed)) {
                                                onEnvelopeChange("sustain", clamp(parsed / 100, 0, 1));
                                            }
                                        } else if (e.key === "Escape") {
                                            e.preventDefault();
                                            param.setDraft((selectedEnvelope.sustain * 100).toFixed(1));
                                            e.currentTarget.blur();
                                        }
                                    }}
                                    tabIndex={activeEditorTab.kind === "envelope" ? 0 : -1}
                                />
                            </label>
                        )) : null}
                    </div>
                </div>
            </div>

            {/* ── Body: MSEG preview or envelope editor ── */}
            <div className="min-h-0 flex-1">
                {activeEditorTab.kind === "mseg" ? (
                    <button
                        type="button"
                        className="group relative h-full w-full cursor-pointer transition hover:bg-white/[0.01]"
                        onClick={onOpenMsegEditor}
                        aria-label="Open MSEG editor"
                    >
                        {msegState ? (
                            <MsegPreview
                                points={msegState.shape.points}
                                className="h-full w-full"
                                progressFillEnd={observedMsegPlayhead.progressFillEnd}
                            />
                        ) : (
                            <div className="h-full w-full bg-white/[0.02]" />
                        )}
                        <div className="pointer-events-none absolute inset-0 grid place-items-center opacity-0 transition-opacity group-hover:opacity-100">
                            <span className="rounded-[6px] bg-[rgba(3,5,12,0.6)] px-2.5 py-1 text-[10px] uppercase tracking-[0.15em] text-cyan-300/40">
                                Edit Shape
                            </span>
                        </div>
                    </button>
                ) : selectedEnvelope ? (
                    <DesktopEnvelopeEditor
                        selectedEnvelope={selectedEnvelope}
                        onEnvelopeChange={onEnvelopeChange}
                    />
                ) : null}
            </div>
        </section>
    );
}

function DesktopPatchViewBody() {
    const stageRef = useRef<HTMLDivElement | null>(null);
    const msegEditorSurfaceRef = useRef<SVGSVGElement | null>(null);
    const keyboardElementRef = useRef<PianoKeyboardElement | null>(null);
    const [keyboardRootNote, setKeyboardRootNote] = useState(KEYBOARD_ROOT_NOTE_DEFAULT);
    const shiftKeyboardRootNote = useCallback((direction: -1 | 1, { releaseHeldNotes = true }: { releaseHeldNotes?: boolean } = {}) => {
        if (
            (direction < 0 && keyboardRootNote <= KEYBOARD_ROOT_NOTE_MIN)
            || (direction > 0 && keyboardRootNote >= KEYBOARD_ROOT_NOTE_MAX)
        ) {
            return false;
        }

        if (releaseHeldNotes) {
            keyboardElementRef.current?.allNotesOff?.();
        }

        setKeyboardRootNote((previousRootNote) => Math.min(
            Math.max(previousRootNote + (direction * 12), KEYBOARD_ROOT_NOTE_MIN),
            KEYBOARD_ROOT_NOTE_MAX,
        ));
        return true;
    }, [keyboardRootNote]);
    const curveLab = useDesktopCurveLab();
    const synthView = useSynthPatchViewModel({
        stageRef,
        msegEditorSurfaceRef,
        keyboardRef: keyboardElementRef,
        voiceModeCount: VOICE_MODE_OPTIONS.length,
        onKeyboardOctaveDown: () => shiftKeyboardRootNote(-1, { releaseHeldNotes: false }),
        onKeyboardOctaveUp: () => shiftKeyboardRootNote(1, { releaseHeldNotes: false }),
    });
    const filterResonanceCurveProfile = curveLab.getProfile("filter-resonance-handle");
    const resonanceNormalizedFromQ = useCallback((qValue: number) => (
        curveLab.invertTarget("filter-resonance-handle", filterQToNormalized(qValue))
    ), [curveLab]);
    const resonanceQFromSurface = useCallback((surfaceValue: number) => (
        normalizedToFilterQ(curveLab.evaluateTarget("filter-resonance-handle", surfaceValue))
    ), [curveLab]);

    const handleKeyboardOctaveDown = useCallback(() => {
        shiftKeyboardRootNote(-1);
    }, [shiftKeyboardRootNote]);

    const handleKeyboardOctaveUp = useCallback(() => {
        shiftKeyboardRootNote(1);
    }, [shiftKeyboardRootNote]);

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

    const panField = useMemo(() => (
        <PrecisionNumberField
            ariaLabel="Pan"
            binding={synthView.pan}
            min={-1}
            max={1}
            step={0.001}
            formatDisplay={formatSignedPercent}
            formatEditingValue={formatPanEditingValue}
            parseText={parsePanInput}
            pixelsPerFullRange={180}
            dataRole="wavetable-pan-field"
            width={92}
            height={40}
        />
    ), [synthView.pan]);

    return (
        <div className="cosimo-surface relative flex h-full w-full flex-col gap-3 overflow-hidden rounded-[28px] border border-white/[0.05] px-4 pb-4 pt-2.5 text-slate-100 shadow-[0_26px_80px_rgba(0,0,0,0.48)]">
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
                        bottomRightAccessory={
                            <>
                                {panField}
                                {warpAmountField}
                            </>
                        }
                        className={DESKTOP_GRID_CARD_CLASS}
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
                        className={DESKTOP_GRID_CARD_CLASS}
                    />
                </section>

                <section className="grid min-h-0 items-stretch gap-4 md:grid-cols-2">
                    <DistortionSection
                        distortionMode={synthView.distortionMode}
                        distortionDriveDb={synthView.distortionDriveDb}
                        distortionKnee={synthView.distortionKnee}
                        distortionWet={synthView.distortionWet}
                        distortionWetHPHz={synthView.distortionWetHPHz}
                        distortionWetLPHz={synthView.distortionWetLPHz}
                        observedDistortionHistory={synthView.observedDistortionHistory}
                        observedDistortionScope={synthView.observedDistortionScope}
                        className={DESKTOP_GRID_CARD_CLASS}
                    />
                    <EffectsRackSection
                        chorusEnabled={synthView.chorusEnabled}
                        chorusMix={synthView.chorusMix}
                        chorusMotionMode={synthView.chorusMotionMode}
                        chorusBloomMode={synthView.chorusBloomMode}
                        chorusTone={synthView.chorusTone}
                        chorusFeedback={synthView.chorusFeedback}
                        chorusRingAmount={synthView.chorusRingAmount}
                        chorusRingOffsetMode={synthView.chorusRingOffsetMode}
                        chorusRingFineSemitones={synthView.chorusRingFineSemitones}
                        className={DESKTOP_GRID_CARD_CLASS}
                    />
                </section>

                {synthView.failureDetail ? (
                    <div className="rounded-[22px] border border-fuchsia-300/15 bg-fuchsia-300/8 px-4 py-3 text-sm text-fuchsia-100/90">
                        {synthView.failureDetail}
                    </div>
                ) : null}

                <section className="grid min-h-0 items-stretch gap-4 md:grid-cols-2">
                    <ModulationMatrixSection
                        selectedMsegSlot={synthView.selectedMsegSlot}
                        msegState={synthView.msegState}
                        observedMsegPlayhead={synthView.observedMsegPlayhead}
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

                    <section className={`flex flex-col rounded-[22px] border border-white/[0.05] bg-white/[0.025] p-4 ${DESKTOP_GRID_CARD_CLASS}`}>
                        <DesktopModMatrix
                            routes={synthView.routes}
                            onAddRoute={synthView.handleAddRoute}
                            onRemoveRoute={synthView.handleRemoveRoute}
                            onRouteChange={synthView.handleRouteChange}
                        />
                    </section>
                </section>

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
