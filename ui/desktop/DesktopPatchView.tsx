import {
    useCallback,
    useEffect,
    useMemo,
    useRef,
    useState,
    type ReactNode,
    type KeyboardEvent as ReactKeyboardEvent,
    type PointerEvent as ReactPointerEvent,
    type RefObject,
} from "react";
import {
    PatchConnectionProvider,
    usePatchConnection,
    type PatchConnectionLike,
} from "../shared/cmajor-react";
import type { ResourceClient } from "../shared/resource-client";
import {
    usePatchParameterBinding,
    type PatchControlBinding,
} from "../shared/patch-controls";
import type { EffectModuleId } from "../shared/target-descriptor";
import {
    type SynthFocusBindings,
    type SynthKeyboardInputMode,
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
    SYNTH_COMPACT_CONTROL_CHROME_CLASS,
    SYNTH_COMPACT_CONTROL_TEXT_CLASS,
    SYNTH_GRID_CARD_INSET_SHADOW_CLASS,
    SYNTH_GRID_CARD_SHELL_CLASS,
    SYNTH_GRID_CARD_SIZE_CLASS,
    VOICE_MODE_OPTIONS,
    VoiceGlideControlSurface,
    WavetableStageSection,
} from "../shared/synth-components";
import {
    DEFAULT_KEYBOARD_NOTE_COUNT,
    KeyboardDock,
    type PianoKeyboardElement,
} from "./desktop-keyboard-adapter";
import { NexusNumberField } from "./desktop-nexus-number-field";
import { PrecisionNumberField } from "./desktop-precision-number-field";
import { useDesktopCurveLab } from "./desktop-curve-lab";
import { DesktopModMatrix } from "./desktop-mod-matrix";
import { MobileModMatrix } from "./mobile-mod-matrix";
import {
    EffectsRackWorkspace,
    type GlobalModRailState,
} from "./effects-rack-workspace";
import {
    SYNTH_PRESET_EFFECT_ID,
    useSynthPatchViewModel,
    type SynthPatchViewModel,
} from "../shared/synth-hooks";
import { createPresetBar } from "../shared/effects/preset-bar";
import { createStandaloneEffectPresetController } from "../shared/effects/standalone-effect-presets";
import type { EffectStoredStateAdapter } from "../shared/effects/effect-preset-v2";
import {
    ArticulationControlSurface,
    type ArticulationCardView,
    type ArticulationRangeSegmentView,
    type ArticulationTriggerMode as ArticulationUiTriggerMode,
    type GainEnvelopeView,
    type MsegThumbnailPoint,
} from "./articulation-ui";
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
    MODULATION_MACRO_SLOT_COUNT,
    MODULATION_MSEG_SLOT_COUNT,
    type ModulationRoute,
    type ModulationRouteUpdate,
} from "../shared/modulation";
import type { RackModulationSource } from "../shared/rack-modulation-sources";

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
const DESKTOP_GRID_CARD_CLASS = `w-full ${SYNTH_GRID_CARD_SIZE_CLASS}`;
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
const ARTICULATION_CARD_COLORS = [
    "#87d7f5",
    "#f472b6",
    "#fbbf24",
    "#32f0bc",
    "#a78bfa",
    "#fb7185",
    "#93c5fd",
    "#fcd34d",
] as const;
const MIDI_NOTE_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"] as const;

function getArticulationColor(runtimeSlot: number) {
    return ARTICULATION_CARD_COLORS[Math.abs(runtimeSlot) % ARTICULATION_CARD_COLORS.length];
}

function formatMidiNoteName(note: number) {
    const safeNote = Math.max(0, Math.min(127, Math.round(note)));
    const name = MIDI_NOTE_NAMES[safeNote % 12];
    const octave = Math.floor(safeNote / 12) - 2;

    return `${name}${octave}`;
}

function formatRangeLabel(prefix: string, min: number, max: number) {
    return min === max ? `${prefix} ${min}` : `${prefix} ${min}-${max}`;
}

function formatKeyRangeLabel(min: number, max: number) {
    return min === max
        ? `Key ${formatMidiNoteName(min)}`
        : `Key ${formatMidiNoteName(min)}-${formatMidiNoteName(max)}`;
}

function getFirstKeyRangeForArticulation(
    assignments: Array<{ note: number; articulationId: string }>,
    articulationId: string,
) {
    const notes = assignments
        .filter((assignment) => assignment.articulationId === articulationId)
        .map((assignment) => assignment.note)
        .sort((left, right) => left - right);

    if (notes.length === 0) {
        return null;
    }

    let max = notes[0];
    for (let index = 1; index < notes.length && notes[index] === max + 1; index += 1) {
        max = notes[index];
    }

    return { min: notes[0], max };
}

function makeMsegThumbnailPoints(morph: number): MsegThumbnailPoint[] {
    const amount = Math.max(0, Math.min(1, Number.isFinite(morph) ? morph : 0));

    return [
        { x: 0, y: 0.08 + amount * 0.14, curvePower: 0.85 },
        { x: 0.18, y: 0.84 - amount * 0.22, curvePower: 0.7 + amount * 0.8 },
        { x: 0.55, y: 0.44 + amount * 0.22, curvePower: 1.2 },
        { x: 1, y: 0.18 + amount * 0.08, curvePower: 1 },
    ];
}

function makeGainEnvelopeView(envelope: {
    attackSeconds?: number;
    decaySeconds?: number;
    sustain?: number;
    releaseSeconds?: number;
} | null | undefined): GainEnvelopeView {
    return {
        attackSeconds: envelope?.attackSeconds ?? 0.01,
        decaySeconds: envelope?.decaySeconds ?? 0.25,
        sustain: envelope?.sustain ?? 0.5,
        releaseSeconds: envelope?.releaseSeconds ?? 0.2,
    };
}

function postNativeKeyboardProbeStatus(reason: string) {
    const desktopWindow = globalThis as typeof globalThis & {
        __COSIMO_DESKTOP_KEYBOARD_PROBE__?: boolean;
        webkit?: {
            messageHandlers?: {
                chocHostKeyboard?: {
                    postMessage?: (message: string) => void;
                };
            };
        };
    };

    if (!desktopWindow.__COSIMO_DESKTOP_KEYBOARD_PROBE__) {
        return;
    }

    try {
        desktopWindow.webkit?.messageHandlers?.chocHostKeyboard?.postMessage?.(JSON.stringify({
            action: "discardBufferedEvent",
            eventType: "cosimo-debug",
            key: "",
            code: "",
            reason,
        }));
    } catch {
        // The probe bridge only exists in the native keyboard regression app.
    }
}

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
    morphBinding: PatchControlBinding<number>;
    surfaceRef: RefObject<SVGSVGElement | null>;
    selectedPointIndex: number;
    hoveredSegmentIndex: number;
    activeSegmentIndex: number;
    canUndo: boolean;
    onClose: () => void;
    onUndo: () => void;
    onSelectShape: (shapeIndex: number) => void;
    onMorphChange: (nextValue: number) => void;
    onRateChange: (nextValue: number) => void;
    onToggleLoop: () => void;
    onPointerDown: (event: ReactPointerEvent<SVGSVGElement>) => void;
    onPointerMove: (event: ReactPointerEvent<SVGSVGElement>) => void;
    onPointerLeave: (event: ReactPointerEvent<SVGSVGElement>) => void;
    onPointerUp: (event: ReactPointerEvent<SVGSVGElement>) => void;
    rateFocusBindings: SynthFocusBindings;
};

type ModulationMatrixSectionProps = {
    compact?: boolean;
    focusedSource?: MobileModSource | null;
    selectedMsegSlot: number;
    msegState: MsegState | null;
    selectedMsegMorph: PatchControlBinding<number>;
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
    onSelectMsegShape: (shapeIndex: number) => void;
    onOpenMsegEditor: () => void;
    onMsegMorphChange: (nextValue: number) => void;
    onMsegRateChange: (nextValue: number) => void;
    onToggleMsegLoop: () => void;
    onSelectEnvelopeSlot: (slotIndex: number) => void;
    onEnvelopeChange: (field: "attackSeconds" | "decaySeconds" | "sustain" | "releaseSeconds", nextValue: number) => void;
    onAddRoute: () => void;
    onRemoveRoute: (routeIndex: number) => void;
    onRouteChange: (routeIndex: number, update: ModulationRouteUpdate) => void;
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
                <svg viewBox="0 0 24 24" className="h-[12px] w-[12px]" aria-hidden="true">
                    <path d="M4 17.5 8.5 7 12 17.5 15.5 7 20 17.5" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" />
                </svg>
            );
        case 2:
            return (
                <svg viewBox="0 0 24 24" className="h-[12px] w-[12px]" aria-hidden="true">
                    <path d="M4 16V8L8 8V16L12 16V8L16 8V16L20 16V8" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" />
                </svg>
            );
        case 3:
            return (
                <svg viewBox="0 0 24 24" className="h-[12px] w-[12px]" aria-hidden="true">
                    <path d="M4 16.5C7 16.5 8 6.5 11 6.5C14 6.5 15 17.5 18 17.5C19.5 17.5 20.3 14.5 20 8.5" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" />
                </svg>
            );
        case 4:
            return (
                <svg viewBox="0 0 24 24" className="h-[12px] w-[12px]" aria-hidden="true">
                    <path d="M4 17L10.5 7L13.5 12L20 7" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" />
                    <path d="M4 7L10.5 17L13.5 12L20 17" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.2" opacity="0.8" />
                </svg>
            );
        default:
            return (
                <svg viewBox="0 0 24 24" className="h-[12px] w-[12px]" aria-hidden="true">
                    <path d="M3 12H21" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" />
                </svg>
            );
    }
}

function FilterModeGlyph({ mode }: { mode: number }) {
    switch (mode) {
        case 1:
            return (
                <svg viewBox="0 0 24 24" className="h-[12px] w-[12px]" aria-hidden="true">
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
                <svg viewBox="0 0 24 24" className="h-[12px] w-[12px]" aria-hidden="true">
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
                <svg viewBox="0 0 24 24" className="h-[12px] w-[12px]" aria-hidden="true">
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
                <svg viewBox="0 0 24 24" className="h-[12px] w-[12px]" aria-hidden="true">
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
                <svg viewBox="0 0 24 24" className="h-[12px] w-[12px]" aria-hidden="true">
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
                <svg viewBox="0 0 24 24" className="h-[12px] w-[12px]" aria-hidden="true">
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
            <svg viewBox="0 0 24 24" className="h-[12px] w-[12px]" aria-hidden="true">
                <rect x="4" y="12" width="3" height="7" fill="currentColor" />
                <rect x="10.5" y="8" width="3" height="11" fill="currentColor" />
                <rect x="17" y="5" width="3" height="14" fill="currentColor" />
            </svg>
        );
    }

    if (mode === "round-bars") {
        return (
            <svg viewBox="0 0 24 24" className="h-[12px] w-[12px]" aria-hidden="true">
                <rect x="4" y="12" width="3.2" height="7" rx="1.6" fill="currentColor" />
                <rect x="10.4" y="8" width="3.2" height="11" rx="1.6" fill="currentColor" />
                <rect x="16.8" y="5" width="3.2" height="14" rx="1.6" fill="currentColor" />
            </svg>
        );
    }

    return (
        <svg viewBox="0 0 24 24" className="h-[12px] w-[12px]" aria-hidden="true">
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
    dataRole,
    onClick,
    children,
}: {
    ariaLabel: string;
    title: string;
    dataRole?: string;
    onClick: () => void;
    children: ReactNode;
}) {
    return (
        <button
            data-role={dataRole}
            type="button"
            aria-label={ariaLabel}
            title={title}
            className={`flex h-5 w-5 items-center justify-center ${SYNTH_COMPACT_CONTROL_CHROME_CLASS} text-[var(--section-accent)] opacity-80 transition hover:opacity-100`}
            onClick={onClick}
        >
            {children}
        </button>
    );
}

function MsegMorphRail({
    binding,
    onChange,
    onAdjustingChange,
    className,
}: {
    binding: PatchControlBinding<number>;
    onChange: (nextValue: number) => void;
    onAdjustingChange?: (isAdjusting: boolean) => void;
    className?: string;
}) {
    const railRef = useRef<HTMLDivElement | null>(null);
    const activePointerRef = useRef<{
        pointerId: number;
        captureFailed: boolean;
    } | null>(null);
    const bindingRef = useRef(binding);
    const onAdjustingChangeRef = useRef(onAdjustingChange);
    const updateFromClientXRef = useRef<(clientX: number) => void>(() => undefined);
    bindingRef.current = binding;
    onAdjustingChangeRef.current = onAdjustingChange;
    const value = clamp(Number(binding.value) || 0, 0, 1);

    const updateFromClientX = useCallback((clientX: number) => {
        const rail = railRef.current;
        if (!rail) {
            return;
        }

        const bounds = rail.getBoundingClientRect();
        const nextValue = clamp((clientX - bounds.left) / Math.max(1, bounds.width), 0, 1);
        onChange(nextValue);
    }, [onChange]);
    updateFromClientXRef.current = updateFromClientX;

    const finishDrag = useCallback((pointerId?: number) => {
        const activePointer = activePointerRef.current;
        if (!activePointer || (pointerId !== undefined && activePointer.pointerId !== pointerId)) {
            return;
        }

        activePointerRef.current = null;
        try {
            if (railRef.current?.hasPointerCapture(activePointer.pointerId)) {
                railRef.current.releasePointerCapture(activePointer.pointerId);
            }
        } catch {
            // Capture may already be gone after cancellation, blur, or unmount.
        }
        bindingRef.current.endGesture();
        onAdjustingChangeRef.current?.(false);
    }, []);

    useEffect(() => {
        const handleFallbackPointerMove = (event: PointerEvent) => {
            const activePointer = activePointerRef.current;
            if (!activePointer?.captureFailed || activePointer.pointerId !== event.pointerId) {
                return;
            }
            const rail = railRef.current;
            if (event.target instanceof Node && rail?.contains(event.target)) {
                return;
            }
            if (event.pointerType === "mouse" && event.buttons === 0) {
                finishDrag(event.pointerId);
                return;
            }
            event.preventDefault();
            updateFromClientXRef.current(event.clientX);
        };
        const handlePointerEnd = (event: PointerEvent) => finishDrag(event.pointerId);
        const handleBlur = () => finishDrag();
        const handleVisibilityChange = () => {
            if (document.visibilityState !== "visible") {
                finishDrag();
            }
        };

        window.addEventListener("pointermove", handleFallbackPointerMove, true);
        window.addEventListener("pointerup", handlePointerEnd, true);
        window.addEventListener("pointercancel", handlePointerEnd, true);
        window.addEventListener("blur", handleBlur);
        document.addEventListener("visibilitychange", handleVisibilityChange);
        return () => {
            window.removeEventListener("pointermove", handleFallbackPointerMove, true);
            window.removeEventListener("pointerup", handlePointerEnd, true);
            window.removeEventListener("pointercancel", handlePointerEnd, true);
            window.removeEventListener("blur", handleBlur);
            document.removeEventListener("visibilitychange", handleVisibilityChange);
            finishDrag();
        };
    }, [finishDrag]);

    return (
        <div
            className={`cosimo-mseg-morph-control flex items-center gap-2 rounded-[8px] border px-2.5 py-2 ${className ?? ""}`}
            data-role="mseg-morph-control"
        >
            <span className="shrink-0 text-[9px] font-bold uppercase tracking-[0.14em] text-slate-300/55">Morph</span>
            <div
                ref={railRef}
                role="slider"
                aria-label="MSEG morph"
                aria-valuemin={0}
                aria-valuemax={1}
                aria-valuenow={Number(value.toFixed(3))}
                aria-valuetext={`${Math.round(value * 100)}%`}
                data-role="mseg-morph-slider"
                className="relative h-5 min-w-[132px] flex-1 cursor-ew-resize touch-none rounded-full outline-none"
                onPointerDown={(event) => {
                    if (event.button !== 0) {
                        return;
                    }

                    finishDrag();
                    activePointerRef.current = {
                        pointerId: event.pointerId,
                        captureFailed: false,
                    };
                    try {
                        event.currentTarget.setPointerCapture(event.pointerId);
                    } catch {
                        activePointerRef.current.captureFailed = true;
                    }
                    bindingRef.current.beginGesture();
                    onAdjustingChangeRef.current?.(true);
                    updateFromClientX(event.clientX);
                    event.preventDefault();
                    event.stopPropagation();
                }}
                onPointerMove={(event) => {
                    if (activePointerRef.current?.pointerId !== event.pointerId) {
                        return;
                    }

                    if (event.pointerType === "mouse" && event.buttons === 0) {
                        finishDrag(event.pointerId);
                        return;
                    }

                    updateFromClientX(event.clientX);
                    event.preventDefault();
                    event.stopPropagation();
                }}
                onPointerUp={(event) => finishDrag(event.pointerId)}
                onPointerCancel={(event) => finishDrag(event.pointerId)}
                onLostPointerCapture={(event) => finishDrag(event.pointerId)}
            >
                <div className="absolute left-0 right-0 top-1/2 h-[7px] -translate-y-1/2 rounded-full bg-white/[0.06]" />
                <div
                    className="cosimo-mseg-morph-fill absolute left-0 top-1/2 h-[7px] -translate-y-1/2 rounded-full"
                    style={{ width: `${value * 100}%` }}
                />
                <div
                    className="cosimo-mseg-morph-thumb absolute top-1/2 size-[18px] -translate-x-1/2 -translate-y-1/2 rounded-full"
                    style={{ left: `${value * 100}%` }}
                />
            </div>
            <span className="synth-readout-text w-10 shrink-0 text-right text-[10px] opacity-85">
                {value.toFixed(3)}
            </span>
        </div>
    );
}

function WarpControlCluster({
    warpMode,
    warpAmount,
}: {
    warpMode: PatchControlBinding<number>;
    warpAmount: PatchControlBinding<number>;
}) {
    const modeLabel = getWarpModeLabel(warpMode.value);

    return (
        <div data-role="warp-control-cluster" className={`flex h-6 min-w-0 items-center gap-1 ${SYNTH_COMPACT_CONTROL_CHROME_CLASS} px-1`}>
            <button
                data-role="warp-mode-control"
                type="button"
                aria-label={`Cycle warp mode (currently ${modeLabel})`}
                title={`Warp mode: ${modeLabel}`}
                className="flex h-5 min-w-[72px] items-center gap-1 rounded-[4px] px-1 text-left transition hover:bg-white/[0.06]"
                onClick={() => warpMode.commitValue(cycleWarpMode(warpMode.value))}
            >
                <span className="text-[7px] font-bold uppercase tracking-[0.10em] text-slate-300/45">Warp</span>
                <span className="synth-accent-icon-dot grid size-4 shrink-0 place-items-center rounded-full">
                    <WarpModeGlyph mode={warpMode.value} />
                </span>
                <span className="min-w-0 truncate text-[8px] font-semibold uppercase tracking-[0.06em] text-slate-100/78">
                    {modeLabel}
                </span>
            </button>
            <div className="h-4 w-px shrink-0 bg-white/[0.08]" />
            <NexusNumberField
                label="Warp amount"
                binding={warpAmount}
                min={0}
                max={1}
                step={0.001}
                decimalPlaces={3}
                suffix={null}
                variant="compactOverlay"
                showLabel={false}
                width={62}
                height={20}
            />
        </div>
    );
}

const UNISON_DETUNE_MODE_LABELS = ["Linear", "Super", "Exp", "Inv", "Random"] as const;
const UNISON_STACK_MODE_LABELS = ["Off", "12", "12+7", "Center-12", "Center-24"] as const;
const UNISON_PHASE_MODE_LABELS = ["Free", "Reset"] as const;

function cycleDiscreteValue(binding: PatchControlBinding<number>, maxValue: number) {
    binding.commitValue((Math.round(Number(binding.value) || 0) + 1) % (maxValue + 1));
}

function formatUnisonVoiceCount(value: number) {
    return `${Math.round(clamp(value, 1, 8))}`;
}

function formatUnisonDetune(value: number) {
    return `${Math.round(clamp(value, 0, 1) * 50)} ct`;
}

function parsePercentInput(text: string) {
    const numeric = Number.parseFloat(String(text).replace("%", "").trim());
    return Number.isFinite(numeric) ? clamp(numeric / 100, 0, 1) : null;
}

function parseUnisonDetuneInput(text: string) {
    const numeric = Number.parseFloat(String(text).replace(/ct|cents?/gi, "").trim());
    return Number.isFinite(numeric) ? clamp(numeric / 50, 0, 1) : null;
}

function unisonSpreadScalar(index: number, count: number, mode: number) {
    if (count <= 1) {
        return 0;
    }

    const normalized = (index / Math.max(1, count - 1)) * 2 - 1;

    if (mode === 1) {
        return Math.sin(normalized * Math.PI * 0.5);
    }

    if (mode === 2) {
        return Math.sign(normalized) * Math.abs(normalized) ** 1.6;
    }

    if (mode === 3) {
        return Math.sign(normalized) * (1 - (1 - Math.abs(normalized)) ** 1.6);
    }

    if (mode === 4) {
        const seeded = Math.sin(((index + 1) * 37 + count * 19) * 12.9898) * 43758.5453;
        return ((seeded % 1 + 1) % 1) * 2 - 1;
    }

    return normalized;
}

function unisonStackSemitones(index: number, count: number, stackMode: number) {
    if (count <= 1 || stackMode === 0) {
        return 0;
    }

    if (stackMode === 1) {
        return index * 12;
    }

    if (stackMode === 2) {
        return index % 2 === 0
            ? Math.floor(index / 2) * 12
            : Math.floor(index / 2) * 12 + 7;
    }

    const center = (count - 1) * 0.5;
    const offset = index - center;
    return offset * (stackMode === 4 ? 24 : 12);
}

function UnisonDistributionView({
    voices,
    detune,
    blend,
    width,
    detuneMode,
    stackMode,
    wavetablePositionSpread,
    warpSpread,
}: {
    voices: number;
    detune: number;
    blend: number;
    width: number;
    detuneMode: number;
    stackMode: number;
    wavetablePositionSpread: number;
    warpSpread: number;
}) {
    const count = Math.round(clamp(voices, 1, 8));
    const points = Array.from({ length: count }, (_, index) => {
        const spread = unisonSpreadScalar(index, count, detuneMode);
        const stackSemitones = unisonStackSemitones(index, count, stackMode);
        const pitchOffset = spread * detune * 0.5 + stackSemitones / 48;
        const centerDistance = count <= 1 ? 0 : Math.abs(index - ((count - 1) * 0.5)) / Math.max(1, (count - 1) * 0.5);
        const weight = (1 - blend) * (1 - centerDistance) + blend;

        return {
            x: 50 + (spread * width * 38),
            y: 45 - clamp(pitchOffset, -1, 1) * 28,
            spread,
            radius: 2.8 + weight * 2.8,
        };
    });
    const wtExtent = wavetablePositionSpread * 38;
    const warpExtent = warpSpread * 38;

    return (
        <div
            data-role="unison-visualization"
            className="relative min-h-[92px] overflow-hidden rounded-[14px] border border-cyan-200/[0.09] bg-[radial-gradient(circle_at_50%_30%,rgba(34,211,238,0.10),rgba(2,6,14,0.78)_60%)]"
        >
            <svg viewBox="0 0 100 92" className="h-full w-full" aria-hidden="true">
                <line x1="50" y1="10" x2="50" y2="68" stroke="rgba(148,163,184,0.20)" strokeDasharray="2 4" />
                <line x1="12" y1="45" x2="88" y2="45" stroke="rgba(148,163,184,0.16)" />
                <path
                    d={`M ${50 - wtExtent} 75 L ${50 + wtExtent} 75`}
                    stroke="rgba(125,211,252,0.72)"
                    strokeWidth="3"
                    strokeLinecap="round"
                />
                <path
                    d={`M ${50 - warpExtent} 84 L ${50 + warpExtent} 84`}
                    stroke="rgba(251,191,36,0.72)"
                    strokeWidth="3"
                    strokeLinecap="round"
                />
                {points.map((point, index) => (
                    <g key={`${index}-${point.x.toFixed(2)}`}>
                        <line
                            x1="50"
                            y1="45"
                            x2={point.x}
                            y2={point.y}
                            stroke="rgba(103,232,249,0.20)"
                            strokeWidth="1"
                        />
                        <circle
                            cx={point.x}
                            cy={point.y}
                            r={point.radius}
                            fill={index % 2 === 0 ? "rgba(103,232,249,0.88)" : "rgba(251,191,36,0.88)"}
                            stroke="rgba(255,255,255,0.65)"
                            strokeWidth="0.6"
                        />
                    </g>
                ))}
                <text x="8" y="78" fill="rgba(203,213,225,0.54)" fontSize="5" letterSpacing="0">WT</text>
                <text x="8" y="87" fill="rgba(203,213,225,0.54)" fontSize="5" letterSpacing="0">Warp</text>
            </svg>
        </div>
    );
}

function UnisonModeButton({
    label,
    value,
    binding,
    max,
    dataRole,
}: {
    label: string;
    value: string;
    binding: PatchControlBinding<number>;
    max: number;
    dataRole: string;
}) {
    return (
        <button
            type="button"
            data-role={dataRole}
            className="grid h-10 min-w-0 rounded-[10px] border border-white/[0.07] bg-black/28 px-2 py-1 text-left transition hover:bg-white/[0.045]"
            onClick={() => cycleDiscreteValue(binding, max)}
            title={`${label}: ${value}`}
        >
            <span className="text-[8px] font-bold uppercase tracking-[0.14em] text-slate-400/70">{label}</span>
            <span className="truncate text-[10px] font-semibold uppercase tracking-[0.08em] text-cyan-100/90">{value}</span>
        </button>
    );
}

function UnisonField({
    label,
    children,
}: {
    label: string;
    children: ReactNode;
}) {
    return (
        <label className="grid min-w-0 gap-1">
            <span className="text-[8px] font-bold uppercase tracking-[0.14em] text-slate-400/70">{label}</span>
            {children}
        </label>
    );
}

function UnisonControlSurface({
    unisonVoices,
    unisonDetune,
    unisonBlend,
    unisonWidth,
    unisonPhase,
    unisonRandom,
    unisonPhaseMode,
    unisonDetuneMode,
    unisonStackMode,
    unisonWavetablePositionSpread,
    unisonWarpSpread,
    observedUnisonState,
}: {
    unisonVoices: PatchControlBinding<number>;
    unisonDetune: PatchControlBinding<number>;
    unisonBlend: PatchControlBinding<number>;
    unisonWidth: PatchControlBinding<number>;
    unisonPhase: PatchControlBinding<number>;
    unisonRandom: PatchControlBinding<number>;
    unisonPhaseMode: PatchControlBinding<number>;
    unisonDetuneMode: PatchControlBinding<number>;
    unisonStackMode: PatchControlBinding<number>;
    unisonWavetablePositionSpread: PatchControlBinding<number>;
    unisonWarpSpread: PatchControlBinding<number>;
    observedUnisonState: {
        hasActive: boolean;
        voices: number;
        detune: number;
        blend: number;
        width: number;
        detuneMode: number;
        stackMode: number;
        wavetablePositionSpread: number;
        warpSpread: number;
    };
}) {
    const visualState = observedUnisonState.hasActive
        ? observedUnisonState
        : {
            hasActive: false,
            voices: unisonVoices.value,
            detune: unisonDetune.value,
            blend: unisonBlend.value,
            width: unisonWidth.value,
            detuneMode: unisonDetuneMode.value,
            stackMode: unisonStackMode.value,
            wavetablePositionSpread: unisonWavetablePositionSpread.value,
            warpSpread: unisonWarpSpread.value,
        };

    return (
        <section
            data-role="unison-control-surface"
            className="grid min-w-0 gap-2 rounded-[18px] border border-white/[0.055] bg-white/[0.022] p-3"
        >
            <div className="flex items-center justify-between gap-3">
                <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-300/60">Unison</span>
                <div className="flex items-center gap-1.5">
                    <button
                        type="button"
                        data-role="unison-voices-down"
                        className="grid size-7 place-items-center rounded-[9px] border border-white/[0.07] bg-black/30 text-slate-200/80 hover:bg-white/[0.045]"
                        onClick={() => unisonVoices.commitValue(clamp(unisonVoices.value - 1, 1, 8))}
                        aria-label="Decrease unison voices"
                    >
                        -
                    </button>
                    <PrecisionNumberField
                        ariaLabel="Unison voices"
                        binding={unisonVoices}
                        min={1}
                        max={8}
                        step={1}
                        width={58}
                        height={30}
                        formatDisplay={formatUnisonVoiceCount}
                        formatEditingValue={(value) => String(Math.round(value))}
                        parseText={(text) => Number.parseInt(text.trim(), 10)}
                        dataRole="unison-voices-control"
                    />
                    <button
                        type="button"
                        data-role="unison-voices-up"
                        className="grid size-7 place-items-center rounded-[9px] border border-white/[0.07] bg-black/30 text-slate-200/80 hover:bg-white/[0.045]"
                        onClick={() => unisonVoices.commitValue(clamp(unisonVoices.value + 1, 1, 8))}
                        aria-label="Increase unison voices"
                    >
                        +
                    </button>
                </div>
            </div>

            <div className="grid gap-3 lg:grid-cols-[minmax(168px,0.78fr)_minmax(0,1.22fr)]">
                <UnisonDistributionView
                    voices={visualState.voices}
                    detune={visualState.detune}
                    blend={visualState.blend}
                    width={visualState.width}
                    detuneMode={visualState.detuneMode}
                    stackMode={visualState.stackMode}
                    wavetablePositionSpread={visualState.wavetablePositionSpread}
                    warpSpread={visualState.warpSpread}
                />
                <div className="grid min-w-0 gap-2">
                    <div className="grid grid-cols-3 gap-1.5">
                        <UnisonField label="Detune">
                            <PrecisionNumberField
                                ariaLabel="Unison detune"
                                binding={unisonDetune}
                                min={0}
                                max={1}
                                step={0.001}
                                width={82}
                                height={30}
                                formatDisplay={formatUnisonDetune}
                                formatEditingValue={(value) => String(Math.round(value * 50))}
                                parseText={parseUnisonDetuneInput}
                                dataRole="unison-detune-control"
                            />
                        </UnisonField>
                        <UnisonField label="Blend">
                            <PrecisionNumberField
                                ariaLabel="Unison blend"
                                binding={unisonBlend}
                                min={0}
                                max={1}
                                step={0.001}
                                width={82}
                                height={30}
                                formatDisplay={formatPercent}
                                formatEditingValue={(value) => String(Math.round(value * 100))}
                                parseText={parsePercentInput}
                                dataRole="unison-blend-control"
                            />
                        </UnisonField>
                        <UnisonField label="Width">
                            <PrecisionNumberField
                                ariaLabel="Unison width"
                                binding={unisonWidth}
                                min={0}
                                max={1}
                                step={0.001}
                                width={82}
                                height={30}
                                formatDisplay={formatPercent}
                                formatEditingValue={(value) => String(Math.round(value * 100))}
                                parseText={parsePercentInput}
                                dataRole="unison-width-control"
                            />
                        </UnisonField>
                    </div>
                    <div className="grid grid-cols-3 gap-1.5">
                        <UnisonField label="Phase">
                            <PrecisionNumberField
                                ariaLabel="Unison phase"
                                binding={unisonPhase}
                                min={0}
                                max={1}
                                step={0.001}
                                width={82}
                                height={30}
                                formatDisplay={formatPercent}
                                formatEditingValue={(value) => String(Math.round(value * 100))}
                                parseText={parsePercentInput}
                                dataRole="unison-phase-control"
                            />
                        </UnisonField>
                        <UnisonField label="Random">
                            <PrecisionNumberField
                                ariaLabel="Unison random"
                                binding={unisonRandom}
                                min={0}
                                max={1}
                                step={0.001}
                                width={82}
                                height={30}
                                formatDisplay={formatPercent}
                                formatEditingValue={(value) => String(Math.round(value * 100))}
                                parseText={parsePercentInput}
                                dataRole="unison-random-control"
                            />
                        </UnisonField>
                        <UnisonField label="WT Pos">
                            <PrecisionNumberField
                                ariaLabel="Unison wavetable position spread"
                                binding={unisonWavetablePositionSpread}
                                min={0}
                                max={1}
                                step={0.001}
                                width={82}
                                height={30}
                                formatDisplay={formatPercent}
                                formatEditingValue={(value) => String(Math.round(value * 100))}
                                parseText={parsePercentInput}
                                dataRole="unison-wt-spread-control"
                            />
                        </UnisonField>
                    </div>
                    <div className="grid grid-cols-[82px_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)] gap-1.5">
                        <UnisonField label="Warp">
                            <PrecisionNumberField
                                ariaLabel="Unison warp spread"
                                binding={unisonWarpSpread}
                                min={0}
                                max={1}
                                step={0.001}
                                width={82}
                                height={30}
                                formatDisplay={formatPercent}
                                formatEditingValue={(value) => String(Math.round(value * 100))}
                                parseText={parsePercentInput}
                                dataRole="unison-warp-spread-control"
                            />
                        </UnisonField>
                        <UnisonModeButton
                            label="Mode"
                            value={UNISON_DETUNE_MODE_LABELS[Math.round(unisonDetuneMode.value)] ?? "Linear"}
                            binding={unisonDetuneMode}
                            max={4}
                            dataRole="unison-detune-mode-control"
                        />
                        <UnisonModeButton
                            label="Stack"
                            value={UNISON_STACK_MODE_LABELS[Math.round(unisonStackMode.value)] ?? "Off"}
                            binding={unisonStackMode}
                            max={4}
                            dataRole="unison-stack-mode-control"
                        />
                        <UnisonModeButton
                            label="Phase"
                            value={UNISON_PHASE_MODE_LABELS[Math.round(unisonPhaseMode.value)] ?? "Free"}
                            binding={unisonPhaseMode}
                            max={1}
                            dataRole="unison-phase-mode-control"
                        />
                    </div>
                </div>
            </div>
        </section>
    );
}

function DesktopEnvelopeEditor({
    selectedEnvelope,
    onEnvelopeChange,
    compact = false,
}: {
    selectedEnvelope: NonNullable<ModulationMatrixSectionProps["selectedEnvelope"]>;
    onEnvelopeChange: ModulationMatrixSectionProps["onEnvelopeChange"];
    compact?: boolean;
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

        const clearActiveDrag = () => {
            setActiveHandle(null);
            setActivePointerId(null);
        };

        const handlePointerMove = (event: PointerEvent) => {
            if (event.pointerId !== activePointerId) {
                return;
            }

            if (event.pointerType === "mouse" && event.buttons === 0) {
                clearActiveDrag();
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

        const handleVisibilityChange = () => {
            if (document.visibilityState !== "visible") {
                clearActiveDrag();
            }
        };

        window.addEventListener("pointermove", handlePointerMove);
        window.addEventListener("pointerup", clearActiveDrag);
        window.addEventListener("pointercancel", clearActiveDrag);
        window.addEventListener("blur", clearActiveDrag);
        document.addEventListener("visibilitychange", handleVisibilityChange);

        return () => {
            window.removeEventListener("pointermove", handlePointerMove);
            window.removeEventListener("pointerup", clearActiveDrag);
            window.removeEventListener("pointercancel", clearActiveDrag);
            window.removeEventListener("blur", clearActiveDrag);
            document.removeEventListener("visibilitychange", handleVisibilityChange);
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
        <div className="relative h-full overflow-hidden bg-[rgb(var(--cosimo-recess-rgb)/0.92)]">
                <svg
                    ref={svgRef}
                    viewBox={`0 0 ${ENVELOPE_VIEWBOX.width} ${ENVELOPE_VIEWBOX.height}`}
                    preserveAspectRatio={compact ? "none" : undefined}
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
                        fill="rgb(var(--section-accent-rgb) / 0.03)"
                    />
                    <rect
                        x={geometry.decayRegionStart}
                        y={geometry.plotTop}
                        width={geometry.decayRegionWidth}
                        height={geometry.plotHeight}
                        rx={16}
                        fill="rgb(var(--section-accent-rgb) / 0.045)"
                    />
                    <rect
                        x={geometry.noteOffX}
                        y={geometry.plotTop}
                        width={geometry.releaseRegionWidth}
                        height={geometry.plotHeight}
                        rx={16}
                        fill="rgb(var(--section-accent-rgb) / 0.04)"
                    />

                    <line
                        x1={geometry.noteOffX}
                        y1={geometry.plotTop}
                        x2={geometry.noteOffX}
                        y2={geometry.plotBottom}
                        stroke="rgb(var(--section-accent-rgb) / 0.84)"
                        strokeWidth={2}
                        strokeDasharray="7 7"
                    />

                    <path d={envelopeFillPath} fill="rgb(var(--section-accent-rgb) / 0.10)" />
                    <path
                        d={envelopePath}
                        fill="none"
                        stroke="var(--section-accent)"
                        strokeWidth={4}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                    />

                    <circle
                        cx={geometry.attackX}
                        cy={geometry.plotTop}
                        r={13}
                        fill="rgb(var(--cosimo-recess-rgb) / 0.94)"
                        stroke="var(--section-accent)"
                        strokeWidth={3}
                    />
                    <circle cx={geometry.attackX} cy={geometry.plotTop} r={4} fill="var(--section-accent)" />
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
                        fill="rgb(var(--cosimo-recess-rgb) / 0.94)"
                        stroke="var(--section-accent)"
                        strokeWidth={3}
                    />
                    <circle cx={geometry.decayX} cy={geometry.sustainY} r={4} fill="var(--section-accent)" />
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
                        fill="rgb(var(--cosimo-recess-rgb) / 0.94)"
                        stroke="var(--section-accent)"
                        strokeWidth={3}
                    />
                    <circle cx={geometry.releaseX} cy={geometry.plotBottom} r={4} fill="var(--section-accent)" />
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
            <span className="text-[10px] uppercase tracking-[0.16em] text-[var(--cosimo-text-muted)]">{statusText}</span>
        </header>
    );
}

function SynthPresetBarHost({
    isHidden,
    storedStateAdapters,
}: {
    isHidden: boolean;
    storedStateAdapters: EffectStoredStateAdapter[];
}) {
    const patchConnection = usePatchConnection();
    const hostRef = useRef<HTMLDivElement | null>(null);
    const presetController = useMemo(() => createStandaloneEffectPresetController({
        effectID: SYNTH_PRESET_EFFECT_ID,
        patchConnection,
        storedStateAdapters,
    }), [patchConnection, storedStateAdapters]);

    useEffect(() => {
        const host = hostRef.current;

        if (!host) {
            return;
        }

        const presetBar = createPresetBar();
        presetBar.controller = presetController;
        host.replaceChildren(presetBar);
        presetController.attach();

        return () => {
            presetController.detach();
            presetBar.controller = null;
            presetBar.remove();
        };
    }, [presetController]);

    return (
        <div
            ref={hostRef}
            data-role="synth-preset-bar-host"
            hidden={isHidden}
            className="relative z-40 min-w-0 shrink-0 overflow-visible rounded-[12px] border border-white/[0.06] bg-black/20 [--knob-track-value-color:#87d7f5] [--preset-bar-border-radius:12px]"
        />
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
            data-layout-card="desktop-grid-card"
            data-section-accent="violet"
            data-liquid-detail="display-lip"
            className={`${SYNTH_GRID_CARD_SHELL_CLASS} border ${className ?? ""}`}
        >
            <div className={SYNTH_GRID_CARD_INSET_SHADOW_CLASS} />

            <div className="absolute inset-0 p-1.5">
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

            <div className="absolute inset-x-0 top-0 z-10 flex items-start justify-between p-1.5">
                <OverlayIconChip
                    dataRole="filter-mode-chip"
                    ariaLabel={`Cycle filter mode (currently ${getFilterModeLabel(filterMode.value)})`}
                    title={`Filter mode: ${getFilterModeLabel(filterMode.value)}`}
                    onClick={() => filterMode.commitValue(cycleFilterMode(filterMode.value))}
                >
                    <FilterModeGlyph mode={filterMode.value} />
                </OverlayIconChip>

                <OverlayIconChip
                    dataRole="filter-analyzer-chip"
                    ariaLabel={`Cycle analyzer view (currently ${getFilterSpectrumRenderModeLabel(spectrumRenderMode)})`}
                    title={`Analyzer view: ${getFilterSpectrumRenderModeLabel(spectrumRenderMode)}`}
                    onClick={() => setSpectrumRenderMode((previousMode) => cycleFilterSpectrumRenderMode(previousMode))}
                >
                    <FilterSpectrumModeGlyph mode={spectrumRenderMode} />
                </OverlayIconChip>
            </div>

            <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 flex items-end justify-between gap-1.5 p-1.5">
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
                        variant="compactOverlay"
                        width={72}
                        height={22}
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
                        variant="compactOverlay"
                        width={44}
                        height={22}
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
    unisonVoices,
    unisonDetune,
    unisonBlend,
    unisonWidth,
    unisonPhase,
    unisonRandom,
    unisonPhaseMode,
    unisonDetuneMode,
    unisonStackMode,
    unisonWavetablePositionSpread,
    unisonWarpSpread,
    observedUnisonState,
    playModeFocusBindings,
    glideFocusTarget,
}: VoiceGlideSectionProps & {
    unisonVoices: PatchControlBinding<number>;
    unisonDetune: PatchControlBinding<number>;
    unisonBlend: PatchControlBinding<number>;
    unisonWidth: PatchControlBinding<number>;
    unisonPhase: PatchControlBinding<number>;
    unisonRandom: PatchControlBinding<number>;
    unisonPhaseMode: PatchControlBinding<number>;
    unisonDetuneMode: PatchControlBinding<number>;
    unisonStackMode: PatchControlBinding<number>;
    unisonWavetablePositionSpread: PatchControlBinding<number>;
    unisonWarpSpread: PatchControlBinding<number>;
    observedUnisonState: SynthPatchViewModel["observedUnisonState"];
    playModeFocusBindings: SynthFocusBindings;
    glideFocusTarget: {
        onActivate: () => void;
        onBeginTextEntry: () => void;
        onEndTextEntry: () => void;
    };
}) {
    return (
        <div className="grid gap-3 xl:grid-cols-[minmax(260px,0.76fr)_minmax(0,1.24fr)]">
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
            <UnisonControlSurface
                unisonVoices={unisonVoices}
                unisonDetune={unisonDetune}
                unisonBlend={unisonBlend}
                unisonWidth={unisonWidth}
                unisonPhase={unisonPhase}
                unisonRandom={unisonRandom}
                unisonPhaseMode={unisonPhaseMode}
                unisonDetuneMode={unisonDetuneMode}
                unisonStackMode={unisonStackMode}
                unisonWavetablePositionSpread={unisonWavetablePositionSpread}
                unisonWarpSpread={unisonWarpSpread}
                observedUnisonState={observedUnisonState}
            />
        </div>
    );
}

function KeyboardSection({
    playMode,
    glideTime,
    unisonVoices,
    unisonDetune,
    unisonBlend,
    unisonWidth,
    unisonPhase,
    unisonRandom,
    unisonPhaseMode,
    unisonDetuneMode,
    unisonStackMode,
    unisonWavetablePositionSpread,
    unisonWarpSpread,
    observedUnisonState,
    keyboardRootNote,
    noteCount = DEFAULT_KEYBOARD_NOTE_COUNT,
    onOctaveDown,
    onOctaveUp,
    playModeFocusBindings,
    glideFocusTarget,
    keyboardRef,
    toolbarOverride,
}: VoiceGlideSectionProps & {
    unisonVoices: PatchControlBinding<number>;
    unisonDetune: PatchControlBinding<number>;
    unisonBlend: PatchControlBinding<number>;
    unisonWidth: PatchControlBinding<number>;
    unisonPhase: PatchControlBinding<number>;
    unisonRandom: PatchControlBinding<number>;
    unisonPhaseMode: PatchControlBinding<number>;
    unisonDetuneMode: PatchControlBinding<number>;
    unisonStackMode: PatchControlBinding<number>;
    unisonWavetablePositionSpread: PatchControlBinding<number>;
    unisonWarpSpread: PatchControlBinding<number>;
    observedUnisonState: SynthPatchViewModel["observedUnisonState"];
    keyboardRootNote: number;
    noteCount?: number;
    onOctaveDown: () => void;
    onOctaveUp: () => void;
    playModeFocusBindings: SynthFocusBindings;
    glideFocusTarget: {
        onActivate: () => void;
        onBeginTextEntry: () => void;
        onEndTextEntry: () => void;
    };
    keyboardRef: RefObject<PianoKeyboardElement | null>;
    toolbarOverride?: ReactNode;
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
            toolbar={toolbarOverride ?? (
                <KeyboardToolbar
                    playMode={playMode}
                    glideTime={glideTime}
                    unisonVoices={unisonVoices}
                    unisonDetune={unisonDetune}
                    unisonBlend={unisonBlend}
                    unisonWidth={unisonWidth}
                    unisonPhase={unisonPhase}
                    unisonRandom={unisonRandom}
                    unisonPhaseMode={unisonPhaseMode}
                    unisonDetuneMode={unisonDetuneMode}
                    unisonStackMode={unisonStackMode}
                    unisonWavetablePositionSpread={unisonWavetablePositionSpread}
                    unisonWarpSpread={unisonWarpSpread}
                    observedUnisonState={observedUnisonState}
                    playModeFocusBindings={playModeFocusBindings}
                    glideFocusTarget={glideFocusTarget}
                />
            )}
            keyboard={<KeyboardDock rootNote={keyboardRootNote} noteCount={noteCount} keyboardRef={keyboardRef} />}
        />
    );
}

function MsegEditorModal({
    isOpen,
    slotLabel,
    msegState,
    morphBinding,
    surfaceRef,
    selectedPointIndex,
    hoveredSegmentIndex,
    activeSegmentIndex,
    canUndo,
    onClose,
    onUndo,
    onSelectShape,
    onMorphChange,
    onRateChange,
    onToggleLoop,
    onPointerDown,
    onPointerMove,
    onPointerLeave,
    onPointerUp,
    rateFocusBindings,
}: MsegEditorModalProps) {
    const [isMorphAdjusting, setIsMorphAdjusting] = useState(false);
    const backdropRef = useRef<HTMLDivElement | null>(null);
    const doneButtonRef = useRef<HTMLButtonElement | null>(null);

    useEffect(() => {
        if (!isOpen) {
            setIsMorphAdjusting(false);
        }
    }, [isOpen]);

    useEffect(() => {
        if (!isOpen || !backdropRef.current) {
            return;
        }

        const previouslyFocused = document.activeElement instanceof HTMLElement ? document.activeElement : null;
        const modalRoot = backdropRef.current;
        const siblings = Array.from(modalRoot.parentElement?.children ?? []).filter(
            (candidate): candidate is HTMLElement => candidate instanceof HTMLElement && candidate !== modalRoot,
        );
        const inertStates = siblings.map((element) => ({ element, inert: element.inert }));
        for (const sibling of siblings) {
            sibling.inert = true;
        }
        doneButtonRef.current?.focus({ preventScroll: true });

        const keepFocusInside = (event: KeyboardEvent) => {
            if (event.key !== "Tab") {
                return;
            }
            const focusable = Array.from(modalRoot.querySelectorAll<HTMLElement>(
                'button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])',
            ));
            if (focusable.length === 0) {
                return;
            }
            const currentIndex = focusable.indexOf(document.activeElement as HTMLElement);
            const nextIndex = event.shiftKey
                ? (currentIndex <= 0 ? focusable.length - 1 : currentIndex - 1)
                : (currentIndex >= focusable.length - 1 ? 0 : currentIndex + 1);
            event.preventDefault();
            focusable[nextIndex]?.focus();
        };

        modalRoot.addEventListener("keydown", keepFocusInside);
        return () => {
            modalRoot.removeEventListener("keydown", keepFocusInside);
            for (const state of inertStates) {
                state.element.inert = state.inert;
            }
            previouslyFocused?.focus({ preventScroll: true });
        };
    }, [isOpen]);

    if (!isOpen || !msegState) {
        return null;
    }

    return (
        <div ref={backdropRef} className="synth-modal-backdrop mseg-editor-backdrop fixed inset-0 z-50 flex items-center justify-center">
            <div
                role="dialog"
                aria-modal="true"
                aria-label={`${slotLabel} editor`}
                data-role="mseg-editor-dialog"
                data-section-accent="mint"
                data-liquid-detail="routing-node"
                className="synth-modal-frame mseg-editor-frame"
            >
                <header className="mseg-editor-header">
                    <div className="synth-section-title mseg-editor-title">{slotLabel}</div>
                    <div className="mseg-editor-shapes" role="group" aria-label="MSEG shape">
                        {[0, 1].map((shapeIndex) => (
                            <button
                                key={`mseg-editor-shape-${shapeIndex}`}
                                type="button"
                                aria-label={`Edit shape ${shapeIndex === 0 ? "A" : "B"}`}
                                aria-pressed={msegState.editShapeIndex === shapeIndex}
                                data-role={shapeIndex === 0 ? "mseg-shape-a" : "mseg-shape-b"}
                                className={`mseg-editor-action ${
                                    msegState.editShapeIndex === shapeIndex
                                        ? "synth-accent-active-button"
                                        : "text-slate-300/55 hover:bg-white/[0.05] hover:text-slate-100"
                                }`}
                                onClick={() => onSelectShape(shapeIndex)}
                            >
                                {shapeIndex === 0 ? "A" : "B"}
                            </button>
                        ))}
                    </div>
                    <button
                        type="button"
                        data-role="mseg-editor-undo"
                        className="mseg-editor-action"
                        disabled={!canUndo}
                        onClick={onUndo}
                    >
                        Undo
                    </button>
                    <button
                        ref={doneButtonRef}
                        type="button"
                        data-role="mseg-editor-done"
                        className="cosimo-button mseg-editor-action"
                        onClick={onClose}
                    >
                        Done
                    </button>
                </header>

                <div className="mseg-editor-graph" data-role="mseg-editor-graph">
                    <EditableMsegSurface
                        surfaceRef={surfaceRef}
                        points={msegState.shape.points}
                        referencePoints={msegState.referenceShape?.points ?? null}
                        morphShapeAPoints={msegState.shapeA?.points ?? null}
                        morphShapeBPoints={msegState.shapeB?.points ?? null}
                        morphValue={morphBinding.value}
                        showMorphCurve={isMorphAdjusting}
                        selectedPointIndex={selectedPointIndex}
                        hoveredSegmentIndex={hoveredSegmentIndex}
                        activeSegmentIndex={activeSegmentIndex}
                        onPointerDown={onPointerDown}
                        onPointerMove={onPointerMove}
                        onPointerLeave={onPointerLeave}
                        onPointerUp={onPointerUp}
                        className="h-full w-full"
                        dataRole="mseg-editor-surface"
                    />
                    <output className="mseg-coordinate-hud" data-role="mseg-coordinate-hud">
                        T {msegState.shape.points[selectedPointIndex]?.x.toFixed(3) ?? "0.000"}
                        {" · "}
                        V {msegState.shape.points[selectedPointIndex]?.y.toFixed(3) ?? "0.000"}
                    </output>
                </div>

                <div className="mseg-editor-controls" data-role="mseg-editor-controls">
                    <label className="mseg-editor-range">
                        <span>Morph</span>
                        <input
                            className="cosimo-range"
                            type="range"
                            min={0}
                            max={1}
                            step={0.001}
                            value={morphBinding.value.toFixed(3)}
                            aria-label="MSEG morph"
                            data-role="mseg-morph-slider"
                            onChange={(event) => onMorphChange(Number(event.currentTarget.value))}
                            onPointerDown={() => setIsMorphAdjusting(true)}
                            onPointerUp={() => setIsMorphAdjusting(false)}
                            onPointerCancel={() => setIsMorphAdjusting(false)}
                        />
                        <output className="synth-readout-text">{formatPercent(morphBinding.value)}</output>
                    </label>
                    <label className="mseg-editor-range mseg-editor-time">
                        <span>Time</span>
                        <input
                            className="cosimo-range"
                            type="range"
                            min={MSEG_RATE_MIN_SECONDS}
                            max={MSEG_RATE_MAX_SECONDS}
                            step={0.001}
                            value={clampMsegRateSeconds(msegState.playback.rate.seconds).toFixed(3)}
                            aria-label="MSEG rate"
                            onChange={(event) => onRateChange(Number(event.currentTarget.value))}
                            {...rateFocusBindings}
                        />
                        <output className="synth-readout-text" data-role="mseg-rate-readout">
                            {formatSeconds(clampMsegRateSeconds(msegState.playback.rate.seconds))}
                        </output>
                    </label>
                    <button
                        type="button"
                        data-role="mseg-loop-toggle"
                        className="cosimo-button mseg-loop-toggle"
                        aria-pressed={msegState.playback.loop !== null}
                        onClick={onToggleLoop}
                    >
                        {msegState.playback.loop ? "Loop" : "1 Shot"}
                    </button>
                </div>
            </div>
        </div>
    );
}

function MacroSourceEditor({
    slotIndex,
    compact = false,
}: {
    slotIndex: number;
    compact?: boolean;
}) {
    const endpointID = `macro${slotIndex + 1}`;
    const coerce = useCallback((rawValue: unknown) => clamp(Number(rawValue) || 0, 0, 1), []);
    const binding = usePatchParameterBinding<number>({
        endpointID,
        initialValue: 0,
        coerce,
    });

    if (compact) {
        return (
            <div data-role="mobile-mod-macro-editor" className="mobile-mod-macro-editor">
                <RangeField
                    label="Value"
                    min={0}
                    max={1}
                    step={0.001}
                    value={binding.value}
                    displayValue={formatPercent(binding.value)}
                    onChange={binding.commitValue}
                    dataRole={`macro-source-value-${slotIndex + 1}`}
                />
            </div>
        );
    }

    return (
        <div className="grid h-full place-items-center p-5">
            <div className="grid w-full max-w-[420px] gap-5 rounded-[18px] border border-white/[0.07] bg-white/[0.025] p-5">
                <div>
                    <div className="synth-section-title">Macro {slotIndex + 1}</div>
                    <p className="mt-1 text-xs text-slate-300/55">
                        One global control feeding every route assigned to this source.
                    </p>
                </div>
                <RangeField
                    label={`Macro ${slotIndex + 1} value`}
                    min={0}
                    max={1}
                    step={0.001}
                    value={binding.value}
                    displayValue={formatPercent(binding.value)}
                    onChange={binding.commitValue}
                    dataRole={`macro-source-value-${slotIndex + 1}`}
                />
            </div>
        </div>
    );
}

function ModulationMatrixSection({
    compact = false,
    focusedSource = null,
    selectedMsegSlot,
    msegState,
    selectedMsegMorph,
    observedMsegPlayhead,
    selectedEnvelopeSlot,
    selectedEnvelope,
    routes,
    onSelectMsegSlot,
    onSelectMsegShape,
    onOpenMsegEditor,
    onMsegMorphChange,
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
        kind: "mseg" | "envelope" | "macro";
        slotIndex: number;
    }>({
        kind: "mseg",
        slotIndex: 0,
    });

    const activeMsegSlot = activeEditorTab.kind === "mseg" ? activeEditorTab.slotIndex : selectedMsegSlot;
    const activeEnvelopeSlot = activeEditorTab.kind === "envelope" ? activeEditorTab.slotIndex : selectedEnvelopeSlot;
    const activeEditorSlotCount = activeEditorTab.kind === "macro"
        ? MODULATION_MACRO_SLOT_COUNT
        : activeEditorTab.kind === "envelope"
            ? MODULATION_ENV_SLOT_COUNT
            : MODULATION_MSEG_SLOT_COUNT;

    useEffect(() => {
        if (!focusedSource) {
            return;
        }

        const slotIndex = focusedSource.sourceSlot - 1;
        if (focusedSource.sourceKind === "macro") {
            setActiveEditorTab((current) => (
                current.kind === "macro" && current.slotIndex === slotIndex
                    ? current
                    : { kind: "macro", slotIndex }
            ));
            return;
        }

        if (focusedSource.sourceKind === "mseg") {
            onSelectMsegSlot(slotIndex);
            setActiveEditorTab((current) => (
                current.kind === "mseg" && current.slotIndex === slotIndex
                    ? current
                    : { kind: "mseg", slotIndex }
            ));
            return;
        }

        onSelectEnvelopeSlot(slotIndex);
        setActiveEditorTab((current) => (
            current.kind === "envelope" && current.slotIndex === slotIndex
                ? current
                : { kind: "envelope", slotIndex }
        ));
    }, [focusedSource, onSelectEnvelopeSlot, onSelectMsegSlot]);

    // MSEG rate drag/edit state
    const msegRateRef = useRef<HTMLInputElement | null>(null);
    const msegRateWheelCursorTimerRef = useRef<number>(0);
    const msegRateDragRef = useRef<{
        pointerId: number;
        startClientX: number;
        startValue: number;
        moved: boolean;
        captureFailed: boolean;
    } | null>(null);
    const [isEditingMsegRate, setIsEditingMsegRate] = useState(false);
    const [draftMsegRate, setDraftMsegRate] = useState("");
    const [isMsegMorphAdjusting, setIsMsegMorphAdjusting] = useState(false);

    const cancelMsegRateDrag = useCallback((pointerId?: number) => {
        const drag = msegRateDragRef.current;
        if (!drag || (pointerId !== undefined && drag.pointerId !== pointerId)) {
            return;
        }

        msegRateDragRef.current = null;
        try {
            if (msegRateRef.current?.hasPointerCapture(drag.pointerId)) {
                msegRateRef.current.releasePointerCapture(drag.pointerId);
            }
        } catch {
            // Capture may already be gone after cancellation, blur, or unmount.
        }
    }, []);

    useEffect(() => {
        const handlePointerEnd = (event: PointerEvent) => cancelMsegRateDrag(event.pointerId);
        const handleBlur = () => cancelMsegRateDrag();
        const handleVisibilityChange = () => {
            if (document.visibilityState !== "visible") {
                cancelMsegRateDrag();
            }
        };

        window.addEventListener("pointerup", handlePointerEnd);
        window.addEventListener("pointercancel", handlePointerEnd);
        window.addEventListener("blur", handleBlur);
        document.addEventListener("visibilitychange", handleVisibilityChange);
        return () => {
            window.removeEventListener("pointerup", handlePointerEnd);
            window.removeEventListener("pointercancel", handlePointerEnd);
            window.removeEventListener("blur", handleBlur);
            document.removeEventListener("visibilitychange", handleVisibilityChange);
            cancelMsegRateDrag();
        };
    }, [cancelMsegRateDrag]);

    const currentMsegRate = clampMsegRateSeconds(Number(msegState?.playback.rate.seconds ?? 1));

    const updateMsegRateDrag = useCallback((event: Pick<PointerEvent, "pointerId" | "pointerType" | "buttons" | "clientX" | "preventDefault">) => {
        const drag = msegRateDragRef.current;
        if (!drag || drag.pointerId !== event.pointerId || isEditingMsegRate) {
            return;
        }
        if (event.pointerType === "mouse" && event.buttons === 0) {
            cancelMsegRateDrag(event.pointerId);
            return;
        }

        event.preventDefault();
        const deltaX = event.clientX - drag.startClientX;
        if (Math.abs(deltaX) >= 2) {
            drag.moved = true;
        }
        const range = MSEG_RATE_MAX_SECONDS - MSEG_RATE_MIN_SECONDS;
        const scaled = (deltaX / 120) * range;
        onMsegRateChange(clamp(drag.startValue + scaled, MSEG_RATE_MIN_SECONDS, MSEG_RATE_MAX_SECONDS));
    }, [cancelMsegRateDrag, isEditingMsegRate, onMsegRateChange]);

    useEffect(() => {
        const handleFallbackPointerMove = (event: PointerEvent) => {
            if (msegRateDragRef.current?.captureFailed && event.target !== msegRateRef.current) {
                updateMsegRateDrag(event);
            }
        };

        window.addEventListener("pointermove", handleFallbackPointerMove, { passive: false });
        return () => {
            window.removeEventListener("pointermove", handleFallbackPointerMove);
        };
    }, [updateMsegRateDrag]);

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
        return () => {
            el.removeEventListener("wheel", handler);
            clearTimeout(timerRef.current);
            el.style.cursor = "";
        };
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
    const [activeEnvelopeDraftField, setActiveEnvelopeDraftField] = useState<
        "attackSeconds" | "decaySeconds" | "sustain" | "releaseSeconds" | null
    >(null);

    useEffect(() => {
        if (!selectedEnvelope) {
            return;
        }
        if (activeEnvelopeDraftField !== "attackSeconds") {
            setDraftAttack(formatEnvelopeTimeDisplay(selectedEnvelope.attackSeconds));
        }
        if (activeEnvelopeDraftField !== "decaySeconds") {
            setDraftDecay(formatEnvelopeTimeDisplay(selectedEnvelope.decaySeconds));
        }
        if (activeEnvelopeDraftField !== "sustain") {
            setDraftSustain(formatPercent(selectedEnvelope.sustain));
        }
        if (activeEnvelopeDraftField !== "releaseSeconds") {
            setDraftRelease(formatEnvelopeTimeDisplay(selectedEnvelope.releaseSeconds));
        }
    }, [
        activeEnvelopeDraftField,
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
            event.currentTarget.blur();
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
        <section
            data-role="mseg-card"
            data-source-kind={activeEditorTab.kind === "envelope" ? "env" : activeEditorTab.kind}
            data-source-slot={(activeEditorTab.slotIndex + 1).toString()}
            data-role-source-editor="true"
            data-layout-card="desktop-grid-card"
            data-section-accent="mint"
            className={`flex h-full flex-col ${SYNTH_GRID_CARD_SHELL_CLASS} ${compact ? "mobile-mod-source-editor w-full" : DESKTOP_GRID_CARD_CLASS}`}
        >
            <span
                data-role="mod-source-editor"
                data-source-kind={activeEditorTab.kind === "envelope" ? "env" : activeEditorTab.kind}
                data-source-slot={(activeEditorTab.slotIndex + 1).toString()}
                hidden
            />
            <div
                data-role={compact ? "mobile-mod-integrated-editor" : undefined}
                className={compact ? "mobile-mod-integrated-editor" : "contents"}
            >
            {/* ── Pip selector top-bar ── */}
            <div
                data-role="mobile-mod-source-tabs"
                className="mod-source-tabs flex shrink-0 items-center gap-1.5 px-2.5 py-1.5"
            >
                {compact ? (
                    <div
                        data-role="mobile-mod-source-selector"
                        className="mobile-mod-source-selector"
                        aria-label="Modulation source selector"
                    >
                        <label className="mobile-mod-source-select mobile-mod-source-select-kind">
                            <span className="sr-only">Modulation source type</span>
                            <select
                                data-role="mobile-mod-source-type"
                                aria-label="Modulation source type"
                                value={activeEditorTab.kind}
                                onChange={(event) => {
                                    const nextKind = event.currentTarget.value;
                                    if (nextKind === "mseg") {
                                        onSelectMsegSlot(0);
                                        setActiveEditorTab({ kind: "mseg", slotIndex: 0 });
                                    } else if (nextKind === "envelope") {
                                        onSelectEnvelopeSlot(0);
                                        setActiveEditorTab({ kind: "envelope", slotIndex: 0 });
                                    } else if (nextKind === "macro") {
                                        setActiveEditorTab({ kind: "macro", slotIndex: 0 });
                                    }
                                }}
                            >
                                <option value="mseg">MSEG</option>
                                <option value="envelope">ENV</option>
                                <option value="macro">MACRO</option>
                            </select>
                        </label>
                        <label className="mobile-mod-source-select mobile-mod-source-select-number">
                            <span className="sr-only">Modulation source number</span>
                            <select
                                data-role="mobile-mod-source-number"
                                aria-label="Modulation source number"
                                value={activeEditorTab.slotIndex + 1}
                                onChange={(event) => {
                                    const nextSlotIndex = Number(event.currentTarget.value) - 1;
                                    if (!Number.isInteger(nextSlotIndex) || nextSlotIndex < 0 || nextSlotIndex >= activeEditorSlotCount) {
                                        return;
                                    }
                                    if (activeEditorTab.kind === "mseg") {
                                        onSelectMsegSlot(nextSlotIndex);
                                    } else if (activeEditorTab.kind === "envelope") {
                                        onSelectEnvelopeSlot(nextSlotIndex);
                                    }
                                    setActiveEditorTab({ kind: activeEditorTab.kind, slotIndex: nextSlotIndex });
                                }}
                            >
                                {Array.from({ length: activeEditorSlotCount }, (_, slotIndex) => (
                                    <option key={`mobile-mod-source-slot-${slotIndex}`} value={slotIndex + 1}>
                                        {slotIndex + 1}
                                    </option>
                                ))}
                            </select>
                        </label>
                    </div>
                ) : (
                    <>
                {/* MSEG pips */}
                <div data-role="mobile-mod-source-family" data-source-family="mseg" className="mod-source-family flex items-center gap-1">
                    <div className="flex gap-[3px]">
                        {Array.from({ length: MODULATION_MSEG_SLOT_COUNT }, (_, slotIndex) => (
                            <button
                                key={`mseg-pip-${slotIndex}`}
                                type="button"
                                aria-label={`Select MSEG ${slotIndex + 1}`}
                                className={`grid size-[18px] place-items-center rounded-[5px] border p-0 text-[8px] leading-none font-bold transition max-[480px]:size-7 max-[480px]:rounded-[6px] max-[480px]:text-[10px] ${
                                    activeEditorTab.kind === "mseg" && activeMsegSlot === slotIndex
                                        ? "synth-accent-active-button"
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
                    <span className="synth-section-title ml-0.5">Mseg</span>
                </div>

                {/* Separator */}
                <div className="mod-source-separator mx-0.5 h-3 w-px shrink-0 bg-white/[0.06]" />

                {/* ENV pips */}
                <div data-role="mobile-mod-source-family" data-source-family="env" className="mod-source-family flex items-center gap-1">
                    <div className="flex gap-[3px]">
                        {Array.from({ length: MODULATION_ENV_SLOT_COUNT }, (_, slotIndex) => (
                            <button
                                key={`env-pip-${slotIndex}`}
                                type="button"
                                aria-label={`Select envelope ${slotIndex + 1}`}
                                className={`grid size-[18px] place-items-center rounded-[5px] border p-0 text-[8px] leading-none font-bold transition max-[480px]:size-7 max-[480px]:rounded-[6px] max-[480px]:text-[10px] ${
                                    activeEditorTab.kind === "envelope" && activeEnvelopeSlot === slotIndex
                                        ? "synth-accent-active-button"
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
                    <span className="synth-section-title ml-0.5">Env</span>
                </div>

                <div className="mod-source-separator mx-0.5 h-3 w-px shrink-0 bg-white/[0.06]" />

                <div data-role="mobile-mod-source-family" data-source-family="macro" className="mod-source-family flex items-center gap-1">
                    <div className="flex gap-[3px]">
                        {Array.from({ length: MODULATION_MACRO_SLOT_COUNT }, (_, slotIndex) => (
                            <button
                                key={`macro-pip-${slotIndex}`}
                                type="button"
                                aria-label={`Select macro ${slotIndex + 1}`}
                                className={`grid size-[18px] place-items-center rounded-[5px] border p-0 text-[8px] leading-none font-bold transition max-[480px]:size-7 max-[480px]:rounded-[6px] max-[480px]:text-[10px] ${
                                    activeEditorTab.kind === "macro" && activeEditorTab.slotIndex === slotIndex
                                        ? "synth-accent-active-button"
                                        : "border-white/[0.06] bg-white/[0.02] text-slate-300/40 hover:border-white/10 hover:text-slate-300/65"
                                }`}
                                onClick={() => setActiveEditorTab({ kind: "macro", slotIndex })}
                            >
                                {slotIndex + 1}
                            </button>
                        ))}
                    </div>
                    <span className="synth-section-title ml-0.5">Macro</span>
                </div>
                    </>
                )}

                {/* Right-aligned controls — fixed-height container, both layers always rendered */}
                <div
                    data-role="mobile-mod-active-controls"
                    data-active-source-kind={activeEditorTab.kind}
                    className="mod-source-active-controls relative ml-auto h-[24px] shrink-0 max-[480px]:h-7"
                >
                    {/* MSEG controls */}
                    <div className={`absolute inset-0 flex items-center justify-end gap-2 ${activeEditorTab.kind === "mseg" ? "visible" : "invisible"}`}>
                        <div className="flex items-center gap-1 rounded-[7px] border border-white/[0.05] bg-white/[0.025] p-[2px]">
                            {[0, 1].map((shapeIndex) => (
                                <button
                                    key={`mseg-shape-${shapeIndex}`}
                                    type="button"
                                    aria-label={`Edit MSEG shape ${shapeIndex === 0 ? "A" : "B"}`}
                                    aria-pressed={msegState?.editShapeIndex === shapeIndex}
                                    className={`grid size-[18px] place-items-center rounded-[5px] p-0 text-[8px] font-bold leading-none transition max-[480px]:size-6 max-[480px]:text-[10px] ${
                                        msegState?.editShapeIndex === shapeIndex
                                            ? "synth-accent-active-button"
                                            : "text-slate-300/45 hover:bg-white/[0.06] hover:text-slate-200/80"
                                    }`}
                                    onClick={() => onSelectMsegShape(shapeIndex)}
                                    tabIndex={activeEditorTab.kind === "mseg" ? 0 : -1}
                                >
                                    {shapeIndex === 0 ? "A" : "B"}
                                </button>
                            ))}
                        </div>
                        <button
                            type="button"
                            aria-label={msegState?.playback.loop ? "Looping" : "One Shot"}
                            className={`grid size-[22px] shrink-0 place-items-center rounded-[6px] border p-0 transition max-[480px]:size-7 ${
                                msegState?.playback.loop
                                    ? "synth-accent-active-button"
                                    : "border-white/[0.06] bg-white/[0.02]"
                            }`}
                            onClick={onToggleMsegLoop}
                            tabIndex={activeEditorTab.kind === "mseg" ? 0 : -1}
                        >
                            <span className="sr-only">{msegState?.playback.loop ? "Looping" : "One Shot"}</span>
                            <svg
                                viewBox="0 0 16 16"
                                className={`size-3 fill-none stroke-[1.5] stroke-current max-[480px]:size-3.5 ${
                                    msegState?.playback.loop ? "text-[var(--section-accent)]" : "text-slate-300/40"
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
                            className={`synth-readout-text w-[56px] touch-none select-none whitespace-nowrap rounded border border-white/[0.04] bg-white/[0.03] px-1.5 py-[3px] text-center text-[10px] leading-none outline-none max-[480px]:w-[64px] max-[480px]:px-2 max-[480px]:py-1 max-[480px]:text-[11px] ${
                                isEditingMsegRate
                                    ? "cursor-text"
                                    : "cursor-ew-resize"
                            }`}
                            value={isEditingMsegRate ? draftMsegRate : formatSeconds(currentMsegRate)}
                            tabIndex={activeEditorTab.kind === "mseg" ? 0 : -1}
                            onPointerDown={(event) => {
                                if (event.button !== 0 || isEditingMsegRate) return;
                                cancelMsegRateDrag();
                                msegRateDragRef.current = {
                                    pointerId: event.pointerId,
                                    startClientX: event.clientX,
                                    startValue: currentMsegRate,
                                    moved: false,
                                    captureFailed: false,
                                };
                                try {
                                    event.currentTarget.setPointerCapture(event.pointerId);
                                } catch {
                                    msegRateDragRef.current.captureFailed = true;
                                }
                                event.preventDefault();
                            }}
                            onPointerMove={updateMsegRateDrag}
                            onPointerUp={(event) => {
                                const drag = msegRateDragRef.current;
                                if (!drag || drag.pointerId !== event.pointerId || isEditingMsegRate) return;
                                msegRateDragRef.current = null;
                                try {
                                    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
                                        event.currentTarget.releasePointerCapture(event.pointerId);
                                    }
                                } catch {
                                    // Capture may already be gone at normal pointer release.
                                }
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
                                cancelMsegRateDrag(event.pointerId);
                            }}
                            onLostPointerCapture={(event) => cancelMsegRateDrag(event.pointerId)}
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
                            { label: "A", compactLabel: "Attack", ariaLabel: "Envelope attack value", field: "attackSeconds" as const, draft: draftAttack, setDraft: setDraftAttack, current: selectedEnvelope.attackSeconds },
                            { label: "D", compactLabel: "Decay", ariaLabel: "Envelope decay value", field: "decaySeconds" as const, draft: draftDecay, setDraft: setDraftDecay, current: selectedEnvelope.decaySeconds },
                            { label: "S", compactLabel: "Sustain", ariaLabel: "Envelope sustain value", field: null, draft: draftSustain, setDraft: setDraftSustain, current: selectedEnvelope.sustain },
                            { label: "R", compactLabel: "Release", ariaLabel: "Envelope release value", field: "releaseSeconds" as const, draft: draftRelease, setDraft: setDraftRelease, current: selectedEnvelope.releaseSeconds },
                        ] as const).map((param) => (
                            <label key={param.label} className="flex items-center gap-[3px]">
                                <span className="text-[9px] font-semibold uppercase text-slate-400/60">
                                    {compact ? param.compactLabel : param.label}
                                </span>
                                <input
                                    aria-label={param.ariaLabel}
                                    type="text"
                                    inputMode="decimal"
                                    className="synth-readout-text w-[38px] rounded border border-white/[0.06] bg-white/[0.03] px-1 py-[2px] text-left text-[9px] leading-none outline-none focus:border-[var(--section-accent)] max-[480px]:w-[44px] max-[480px]:text-[10px]"
                                    value={param.draft}
                                    onFocus={() => setActiveEnvelopeDraftField(param.field ?? "sustain")}
                                    onChange={(e) => param.setDraft(e.target.value)}
                                    onBlur={() => {
                                        if (param.field) {
                                            commitEnvelopeDurationField(param.field, param.draft, param.current);
                                        } else {
                                            const parsed = parseFloat(param.draft);
                                            if (!Number.isFinite(parsed)) {
                                                param.setDraft(formatPercent(selectedEnvelope.sustain));
                                            } else {
                                                onEnvelopeChange("sustain", clamp(parsed / 100, 0, 1));
                                            }
                                        }
                                        setActiveEnvelopeDraftField(null);
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
                                            e.currentTarget.blur();
                                        } else if (e.key === "Escape") {
                                            e.preventDefault();
                                            param.setDraft(formatPercent(selectedEnvelope.sustain));
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

            {!compact ? (
                <div
                    data-role="mod-fixed-sources"
                    className="flex shrink-0 items-center gap-1.5 border-y border-white/[0.05] bg-white/[0.018] px-2.5 py-1.5"
                >
                    <span className="synth-section-title mr-1">Fixed</span>
                    {[
                        { label: "VEL", title: "Note velocity" },
                        { label: "AT", title: "Polyphonic pressure" },
                        { label: "SLIDE", title: "Per-note slide" },
                    ].map((source) => (
                        <span
                            key={source.label}
                            data-role="mod-fixed-source"
                            title={source.title}
                            className="grid min-h-7 min-w-11 place-items-center rounded-[7px] border border-cyan-200/[0.10] bg-cyan-200/[0.035] px-2 font-mono text-[9px] font-semibold tracking-[0.08em] text-cyan-100/60"
                        >
                            {source.label}
                        </span>
                    ))}
                    <span className="ml-auto truncate font-mono text-[8px] text-slate-400/40">performance inputs</span>
                </div>
            ) : null}

            {/* ── Body: MSEG preview or envelope editor ── */}
            <div data-role="mobile-mod-editor-body" className="mobile-mod-editor-body min-h-0 flex-1">
                {activeEditorTab.kind === "mseg" ? (
                    <div className="relative h-full w-full">
                        <button
                            type="button"
                            className="group absolute inset-x-0 top-0 bottom-[48px] cursor-pointer transition hover:bg-white/[0.01]"
                            onClick={onOpenMsegEditor}
                            aria-label="Open MSEG editor"
                        >
                            {msegState ? (
                                <MsegPreview
                                    points={msegState.shape.points}
                                    referencePoints={msegState.referenceShape?.points ?? null}
                                    morphShapeAPoints={msegState.shapeA?.points ?? null}
                                    morphShapeBPoints={msegState.shapeB?.points ?? null}
                                    morphValue={selectedMsegMorph.value}
                                    showMorphCurve={isMsegMorphAdjusting}
                                    className="h-full w-full"
                                    progressFillEnd={observedMsegPlayhead.progressFillEnd}
                                />
                            ) : (
                                <div className="h-full w-full bg-white/[0.02]" />
                            )}
                            <div className="pointer-events-none absolute inset-0 grid place-items-center opacity-0 transition-opacity group-hover:opacity-100">
                                <span className="synth-readout-text rounded-[6px] bg-[rgba(3,5,12,0.6)] px-2.5 py-1 text-[10px] opacity-45">
                                    Edit Shape
                                </span>
                            </div>
                        </button>
                        <div className="absolute inset-x-3 bottom-2">
                            <MsegMorphRail
                                binding={selectedMsegMorph}
                                onChange={onMsegMorphChange}
                                onAdjustingChange={setIsMsegMorphAdjusting}
                            />
                        </div>
                    </div>
                ) : activeEditorTab.kind === "envelope" && selectedEnvelope ? (
                    <DesktopEnvelopeEditor
                        selectedEnvelope={selectedEnvelope}
                        onEnvelopeChange={onEnvelopeChange}
                        compact={compact}
                    />
                ) : activeEditorTab.kind === "macro" ? (
                    <MacroSourceEditor slotIndex={activeEditorTab.slotIndex} compact={compact} />
                ) : null}
            </div>
            </div>
        </section>
    );
}

function ContextualArticulationToolbar({
    articulationIsDirty,
    selectedArticulationName,
    isDismissed,
    onDismiss,
    onUpdateArticulation,
    onSaveAsNewArticulation,
    onRevertArticulation,
}: {
    articulationIsDirty: boolean;
    selectedArticulationName: string | null;
    isDismissed: boolean;
    onDismiss: () => void;
    onUpdateArticulation: () => void;
    onSaveAsNewArticulation: () => void;
    onRevertArticulation: () => void;
}) {
    if (!articulationIsDirty || isDismissed) {
        return null;
    }

    const statusText = `Edited ${selectedArticulationName ?? "articulation"}`;

    const buttonBase = "inline-flex h-7 shrink-0 items-center justify-center whitespace-nowrap rounded-[999px] px-3 text-[10px] font-bold uppercase tracking-[0.12em] transition focus:outline-none focus:ring-2 focus:ring-cyan-200/45";
    const primaryButton = `${buttonBase} border border-amber-200/35 bg-amber-200/16 text-amber-50 shadow-[0_0_18px_rgba(251,191,36,0.10)] hover:bg-amber-200/22`;
    const secondaryButton = `${buttonBase} border border-white/[0.08] bg-white/[0.045] text-slate-100/84 hover:bg-white/[0.07]`;
    const quietButton = `${buttonBase} border border-white/[0.05] bg-transparent text-slate-300/70 hover:bg-white/[0.045] hover:text-slate-100`;

    return (
        <div
            data-role="contextual-floating-toolbar"
            aria-label={statusText}
            className="pointer-events-none fixed bottom-4 left-1/2 z-50 w-[min(calc(100vw-1rem),680px)] -translate-x-1/2 px-2"
        >
            <div className="pointer-events-auto relative mx-auto flex h-10 w-fit max-w-full items-center gap-1.5 overflow-hidden rounded-[12px] border border-white/[0.08] bg-[#070a12]/96 py-1 pl-4 pr-1.5 shadow-[0_18px_54px_rgba(0,0,0,0.54),inset_0_1px_0_rgba(255,255,255,0.04)] backdrop-blur-[2px]">
                <span
                    aria-hidden="true"
                    className="absolute left-2 top-2 h-1.5 w-1.5 rounded-full bg-amber-200 shadow-[0_0_14px_rgba(251,191,36,0.45)]"
                />

                <div className="flex min-w-0 items-center gap-1 overflow-x-auto overflow-y-hidden [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                    <button
                        type="button"
                        aria-label={`Replace ${selectedArticulationName ?? "selected articulation"} with current sound`}
                        data-role="contextual-update-articulation"
                        onClick={onUpdateArticulation}
                        className={primaryButton}
                    >
                        Replace
                    </button>
                    <button
                        type="button"
                        aria-label="Save current sound as a new articulation"
                        data-role="contextual-save-new-articulation"
                        onClick={onSaveAsNewArticulation}
                        className={secondaryButton}
                    >
                        Save New
                    </button>
                    <button
                        type="button"
                        aria-label={`Revert to saved ${selectedArticulationName ?? "articulation"}`}
                        data-role="contextual-revert-articulation"
                        onClick={onRevertArticulation}
                        className={quietButton}
                    >
                        Revert
                    </button>
                </div>

                <button
                    type="button"
                    aria-label="Dismiss contextual toolbar"
                    data-role="contextual-toolbar-dismiss"
                    onClick={onDismiss}
                    className="grid h-7 w-7 shrink-0 place-items-center rounded-full border border-white/[0.05] bg-white/[0.03] text-[11px] font-bold text-slate-300/70 transition hover:bg-white/[0.07] hover:text-slate-100 focus:outline-none focus:ring-2 focus:ring-cyan-200/45"
                >
                    X
                </button>
            </div>
        </div>
    );
}

type MobileWorkspaceSection = "voice" | "fx" | "mod";
type MobileModSource = Pick<RackModulationSource, "sourceKind" | "sourceSlot">;

function MobileWorkspaceAccordion({
    activeSection,
    onSelectSection,
    voice,
    effects,
    modulation,
}: {
    activeSection: MobileWorkspaceSection;
    onSelectSection: (section: MobileWorkspaceSection) => void;
    voice: ReactNode;
    effects: ReactNode;
    modulation: ReactNode;
}) {
    const sections: ReadonlyArray<{
        id: MobileWorkspaceSection;
        label: string;
        content: ReactNode;
    }> = [
        { id: "voice", label: "Voice", content: voice },
        { id: "fx", label: "FX", content: effects },
        { id: "mod", label: "Mod", content: modulation },
    ];

    return (
        <main
            data-role="mobile-workspace-accordion"
            className="mobile-workspace-accordion min-h-0 flex-1"
        >
            {sections.map((section) => {
                const isExpanded = section.id === activeSection;

                return (
                    <section
                        key={section.id}
                        className={`mobile-workspace-section is-${section.id}${isExpanded ? " is-expanded" : ""}`}
                        data-mobile-workspace-section={section.id}
                    >
                        <button
                            type="button"
                            data-role={`mobile-workspace-toggle-${section.id}`}
                            className="mobile-workspace-toggle"
                            aria-expanded={isExpanded}
                            aria-controls={`mobile-workspace-panel-${section.id}`}
                            onClick={() => onSelectSection(section.id)}
                        >
                            {section.label}
                        </button>
                        <div
                            id={`mobile-workspace-panel-${section.id}`}
                            data-role={`mobile-workspace-panel-${section.id}`}
                            className="mobile-workspace-panel"
                            hidden={!isExpanded}
                            aria-hidden={!isExpanded}
                        >
                            {section.content}
                        </div>
                    </section>
                );
            })}
        </main>
    );
}

function DesktopPatchViewBody({
    keyboardInputMode,
}: {
    keyboardInputMode: SynthKeyboardInputMode;
}) {
    const stageRef = useRef<HTMLDivElement | null>(null);
    const scrollRegionRef = useRef<HTMLElement | null>(null);
    const msegEditorSurfaceRef = useRef<SVGSVGElement | null>(null);
    const keyboardElementRef = useRef<PianoKeyboardElement | null>(null);
    const [isCompactViewport, setIsCompactViewport] = useState(() => (
        typeof window.matchMedia === "function" && window.matchMedia("(max-width: 639px)").matches
    ));
    const [mobileWorkspaceSection, setMobileWorkspaceSection] = useState<MobileWorkspaceSection>("voice");
    const [mobileModSource, setMobileModSource] = useState<MobileModSource | null>(null);
    const [mobileReturnSection, setMobileReturnSection] = useState<MobileWorkspaceSection | null>(null);
    const [mobileModRailPortalTarget, setMobileModRailPortalTarget] = useState<HTMLElement | null>(null);
    const [globalModRailState, setGlobalModRailState] = useState<GlobalModRailState>({
        expanded: false,
        selectedSource: { sourceKind: "mseg", sourceSlot: 1 },
    });
    const [selectedRackEffectId, setSelectedRackEffectId] = useState<EffectModuleId>("drive");
    useEffect(() => {
        if (typeof window.matchMedia !== "function") {
            return undefined;
        }
        const mediaQuery = window.matchMedia("(max-width: 639px)");
        const update = () => setIsCompactViewport(mediaQuery.matches);
        update();
        mediaQuery.addEventListener?.("change", update);
        return () => mediaQuery.removeEventListener?.("change", update);
    }, []);
    useEffect(() => {
        if (!isCompactViewport) {
            setMobileWorkspaceSection("voice");
            setMobileModSource(null);
            setMobileReturnSection(null);
        }
    }, [isCompactViewport]);
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
        keyboardInputMode,
        observeFilterSpectrum: !isCompactViewport
            || mobileWorkspaceSection === "voice"
            || (mobileWorkspaceSection === "fx" && selectedRackEffectId === "filter"),
        observeDistortionVisuals: selectedRackEffectId === "drive"
            && (!isCompactViewport || mobileWorkspaceSection === "fx"),
        observeMsegPlayhead: !isCompactViewport
            || mobileWorkspaceSection === "mod"
            || globalModRailState.selectedSource.sourceKind === "mseg",
        onKeyboardOctaveDown: () => shiftKeyboardRootNote(-1, { releaseHeldNotes: false }),
        onKeyboardOctaveUp: () => shiftKeyboardRootNote(1, { releaseHeldNotes: false }),
    });
    useEffect(() => {
        postNativeKeyboardProbeStatus(`cosimo-keyboard-router-ready:${keyboardInputMode}`);
    }, [keyboardInputMode]);
    const [keyboardControlMode, setKeyboardControlMode] = useState<"articulation" | "voice">("articulation");
    const [isArticulationEditorExpanded, setIsArticulationEditorExpanded] = useState(false);
    const [dismissedContextualToolbarKey, setDismissedContextualToolbarKey] = useState<string | null>(null);
    const selectedGlobalModSourceKind = globalModRailState.selectedSource.sourceKind;
    const selectedGlobalModSourceSlot = globalModRailState.selectedSource.sourceSlot;
    useEffect(() => {
        if (
            !isCompactViewport
            || selectedGlobalModSourceKind !== "mseg"
            || synthView.selectedMsegSlot === selectedGlobalModSourceSlot - 1
        ) {
            return;
        }
        synthView.handleSelectMsegSlot(selectedGlobalModSourceSlot - 1);
    }, [
        isCompactViewport,
        selectedGlobalModSourceKind,
        selectedGlobalModSourceSlot,
        synthView.handleSelectMsegSlot,
        synthView.selectedMsegSlot,
    ]);
    const selectedArticulationId = synthView.selectedArticulationSlot?.id ?? null;
    const selectedArticulationName = synthView.selectedArticulationSlot?.name ?? null;
    const articulationMode = synthView.articulationBank.activeTriggerMode as ArticulationUiTriggerMode;
    const contextualToolbarKey = useMemo(() => {
        if (!synthView.selectedArticulationIsDirty) {
            return null;
        }

        return `articulation-dirty:${selectedArticulationId ?? ""}`;
    }, [
        selectedArticulationId,
        synthView.selectedArticulationIsDirty,
    ]);
    useEffect(() => {
        if (!contextualToolbarKey) {
            setDismissedContextualToolbarKey(null);
        }
    }, [contextualToolbarKey]);
    const articulationCards = useMemo<ArticulationCardView[]>(() => {
        const bank = synthView.articulationBank;

        return synthView.articulationSlots.map((slot) => {
            const color = getArticulationColor(slot.runtimeSlot);
            const chainAssignment = bank.chainAssignments.find((assignment) => assignment.articulationId === slot.id);
            const keyRange = getFirstKeyRangeForArticulation(bank.keyAssignments, slot.id);
            const velocityAssignment = bank.velocityAssignments.find((assignment) => assignment.articulationId === slot.id);
            const assignmentLabel = articulationMode === "key"
                ? (keyRange ? formatKeyRangeLabel(keyRange.min, keyRange.max) : "Key -")
                : articulationMode === "vel"
                    ? (velocityAssignment ? formatRangeLabel("Vel", velocityAssignment.min, velocityAssignment.max) : "Vel -")
                    : (chainAssignment ? formatRangeLabel("Chain", chainAssignment.min, chainAssignment.max) : "Chain -");

            return {
                id: slot.id,
                name: slot.name,
                color,
                runtimeSlot: slot.runtimeSlot,
                assignmentLabel,
                isSelected: slot.id === selectedArticulationId,
                isDirty: slot.id === selectedArticulationId && synthView.selectedArticulationIsDirty,
                canDelete: synthView.articulationSlots.length > 1,
                msegPoints: makeMsegThumbnailPoints(slot.snapshot.parameters.msegMorphs[0] ?? 0),
                gainEnvelope: makeGainEnvelopeView(slot.snapshot.envelopes[0]),
            };
        });
    }, [
        articulationMode,
        selectedArticulationId,
        synthView.articulationBank,
        synthView.articulationSlots,
        synthView.selectedArticulationIsDirty,
    ]);
    const articulationCardById = useMemo(() => (
        new Map(articulationCards.map((card) => [card.id, card]))
    ), [articulationCards]);
    const chainSegments = useMemo<ArticulationRangeSegmentView[]>(() => (
        synthView.articulationBank.chainAssignments.map((assignment) => {
            const card = articulationCardById.get(assignment.articulationId);

            return {
                id: assignment.id,
                articulationId: assignment.articulationId,
                label: card?.name ?? "Missing",
                color: card?.color ?? "#87d7f5",
                min: assignment.min,
                max: assignment.max,
                isSelected: assignment.articulationId === selectedArticulationId,
            };
        })
    ), [articulationCardById, selectedArticulationId, synthView.articulationBank.chainAssignments]);
    const velocitySegments = useMemo<ArticulationRangeSegmentView[]>(() => (
        synthView.articulationBank.velocityAssignments.map((assignment) => {
            const card = articulationCardById.get(assignment.articulationId);

            return {
                id: assignment.id,
                articulationId: assignment.articulationId,
                label: card?.name ?? "Missing",
                color: card?.color ?? "#87d7f5",
                min: assignment.min,
                max: assignment.max,
                isSelected: assignment.articulationId === selectedArticulationId,
            };
        })
    ), [articulationCardById, selectedArticulationId, synthView.articulationBank.velocityAssignments]);
    const keySegments = useMemo<ArticulationRangeSegmentView[]>(() => {
        const sortedAssignments = [...synthView.articulationBank.keyAssignments]
            .sort((left, right) => left.note - right.note);
        const segments: ArticulationRangeSegmentView[] = [];

        for (const assignment of sortedAssignments) {
            const previous = segments[segments.length - 1];
            const card = articulationCardById.get(assignment.articulationId);

            if (
                previous
                && previous.articulationId === assignment.articulationId
                && previous.max + 1 === assignment.note
            ) {
                previous.max = assignment.note;
                previous.id = `key-${assignment.articulationId}-${previous.min}-${previous.max}`;
                previous.label = card?.name ?? "Missing";
                continue;
            }

            segments.push({
                id: `key-${assignment.articulationId}-${assignment.note}-${assignment.note}`,
                articulationId: assignment.articulationId,
                label: card?.name ?? "Missing",
                color: card?.color ?? "#87d7f5",
                min: assignment.note,
                max: assignment.note,
                isSelected: assignment.articulationId === selectedArticulationId,
            });
        }

        return segments;
    }, [articulationCardById, selectedArticulationId, synthView.articulationBank.keyAssignments]);
    const handleSelectRangeSegment = useCallback((
        _mode: ArticulationUiTriggerMode,
        segment: ArticulationRangeSegmentView,
    ) => {
        synthView.handleSelectArticulationSlot(segment.articulationId);
    }, [synthView]);
    const handleRenameArticulation = useCallback((slotId: string) => {
        const slot = synthView.articulationSlots.find((candidate) => candidate.id === slotId);
        const nextName = window.prompt("Rename articulation", slot?.name ?? "");

        if (nextName !== null) {
            synthView.handleRenameArticulationSlot(slotId, nextName);
        }
    }, [synthView]);
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

    const warpControlCluster = useMemo(() => (
        <WarpControlCluster
            warpMode={synthView.warpMode}
            warpAmount={synthView.warpAmount}
        />
    ), [synthView.warpAmount, synthView.warpMode]);

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
            enableWheel
            wheelStep={0.01}
            leadingLabel="Pan"
            dataRole="wavetable-pan-field"
            variant="inlineDark"
            width={44}
            height={20}
        />
    ), [synthView.pan]);
    const keyboardToolbarOverride = useMemo(() => (
        <div data-role="keyboard-control-row" className="grid min-h-[158px] min-w-0 gap-2 overflow-hidden">
            <div className="flex min-w-0 items-center justify-between gap-2 overflow-hidden rounded-[12px] border border-white/[0.05] bg-white/[0.018] px-2 py-1.5">
                <span className="min-w-0 truncate text-[10px] font-bold uppercase tracking-[0.18em] text-slate-300/45">
                    Controls
                </span>
                <div className="inline-flex h-7 shrink-0 items-center gap-1 rounded-[8px] border border-white/[0.06] bg-white/[0.022] p-0.5">
                    {([
                        ["articulation", "Articulations"],
                        ["voice", "Voice"],
                    ] as const).map(([mode, label]) => (
                        <button
                            key={mode}
                            type="button"
                            aria-pressed={keyboardControlMode === mode}
                            data-role={`keyboard-control-mode-${mode}`}
                            className={`h-6 rounded-[6px] px-2.5 text-[10px] font-bold uppercase tracking-[0.14em] transition ${
                                keyboardControlMode === mode
                                    ? "bg-amber-300/14 text-amber-100"
                                    : "text-slate-300/65 hover:text-slate-100"
                            }`}
                            onClick={() => setKeyboardControlMode(mode)}
                        >
                            {label}
                        </button>
                    ))}
                </div>
            </div>

            {keyboardControlMode === "articulation" ? (
                <ArticulationControlSurface
                    cards={articulationCards}
                    activeMode={articulationMode}
                    isExpanded={isArticulationEditorExpanded}
                    selectedArticulationId={selectedArticulationId}
                    selectedIsDirty={synthView.selectedArticulationIsDirty}
                    discardedEditLabel={synthView.discardedArticulationEdit?.slotName ?? null}
                    canCapture={synthView.hasHydratedArticulations}
                    chainSegments={chainSegments}
                    keySegments={keySegments}
                    velocitySegments={velocitySegments}
                    heldInput={synthView.articulationHeldInput}
                    keyboardMinNote={keyboardRootNote}
                    keyboardMaxNote={keyboardRootNote + DEFAULT_KEYBOARD_NOTE_COUNT - 1}
                    onToggleExpanded={() => setIsArticulationEditorExpanded((previousValue) => !previousValue)}
                    onSelectMode={(mode) => synthView.handleSetArticulationTriggerMode(mode)}
                    onSelectCard={synthView.handleSelectArticulationSlot}
                    onCardPlayPressStart={synthView.handleStartArticulationAudition}
                    onCardPlayPressEnd={synthView.handleStopArticulationAudition}
                    onCapture={() => synthView.handleCaptureArticulationSlot({ autoAssign: !isArticulationEditorExpanded })}
                    onUpdate={synthView.handleUpdateSelectedArticulationSlot}
                    onRevert={synthView.handleRevertSelectedArticulationSlot}
                    onUndoDiscard={synthView.handleUndoDiscardedArticulationEdit}
                    onSelectRangeSegment={handleSelectRangeSegment}
                    onAssignRangePosition={synthView.handleAssignArticulationRangePosition}
                    onInsertRangePosition={synthView.handleInsertArticulationRangeAtPosition}
                    onDuplicateAndAssignRangePosition={synthView.handleDuplicateAndAssignArticulationRangePosition}
                    onMoveRangeSegment={synthView.handleMoveArticulationRangeAssignment}
                    onResizeRangeSegment={synthView.handleResizeArticulationRangeAssignment}
                    onClearRangeSegment={synthView.handleClearArticulationRangeAssignment}
                    onClearRangeMode={synthView.handleClearArticulationTriggerAssignments}
                    onDistributeRange={synthView.handleDistributeArticulationRanges}
                    onRequestRename={handleRenameArticulation}
                    onRequestDuplicate={synthView.handleDuplicateArticulationSlot}
                    onRequestReplace={synthView.handleReplaceArticulationSlotWithCurrent}
                    onRequestDelete={synthView.handleDeleteArticulationSlot}
                />
            ) : (
                <KeyboardToolbar
                    playMode={synthView.playMode}
                    glideTime={synthView.glideTime}
                    unisonVoices={synthView.unisonVoices}
                    unisonDetune={synthView.unisonDetune}
                    unisonBlend={synthView.unisonBlend}
                    unisonWidth={synthView.unisonWidth}
                    unisonPhase={synthView.unisonPhase}
                    unisonRandom={synthView.unisonRandom}
                    unisonPhaseMode={synthView.unisonPhaseMode}
                    unisonDetuneMode={synthView.unisonDetuneMode}
                    unisonStackMode={synthView.unisonStackMode}
                    unisonWavetablePositionSpread={synthView.unisonWavetablePositionSpread}
                    unisonWarpSpread={synthView.unisonWarpSpread}
                    observedUnisonState={synthView.observedUnisonState}
                    playModeFocusBindings={synthView.keyboardRouting.playModeFocusBindings}
                    glideFocusTarget={synthView.keyboardRouting.glideFocusTarget}
                />
            )}

        </div>
    ), [
        articulationCards,
        articulationMode,
        chainSegments,
        handleRenameArticulation,
        handleSelectRangeSegment,
        isArticulationEditorExpanded,
        keySegments,
        keyboardControlMode,
        keyboardRootNote,
        selectedArticulationId,
        synthView,
        velocitySegments,
    ]);

    const selectMobileWorkspaceSection = useCallback((section: MobileWorkspaceSection) => {
        setMobileWorkspaceSection(section);
        setMobileReturnSection(null);
    }, []);

    const openMobileModSource = useCallback((source: MobileModSource) => {
        setMobileModSource(source);
        setMobileReturnSection(mobileWorkspaceSection);
        setMobileWorkspaceSection("mod");
    }, [mobileWorkspaceSection]);

    const returnFromMobileModSource = useCallback(() => {
        setMobileWorkspaceSection(mobileReturnSection ?? "fx");
        setMobileReturnSection(null);
    }, [mobileReturnSection]);

    const voiceWorkspace = (
        <>
        <section className="mobile-voice-grid grid min-h-0 grid-cols-1 items-stretch gap-4 md:grid-cols-2">
            <WavetableStageSection
                stageRef={stageRef}
                frames={synthView.frames}
                position={synthView.observedPosition}
                warpMode={synthView.observedWarpState.hasActive ? synthView.observedWarpState.mode : synthView.warpMode.value}
                warpAmount={synthView.observedWarpState.hasActive ? synthView.observedWarpState.amount : synthView.warpAmount.value}
                tableName={synthView.displayedTableName}
                pendingTableName={synthView.runtimePresentation.isPendingSelection ? synthView.desiredTableName : null}
                frameCount={synthView.displayedFrameCount}
                desiredTableIndex={synthView.desiredTableIndex}
                tableOptions={synthView.tableOptions}
                canRetry={synthView.canRetryDesiredTableLoad}
                onTableChange={synthView.handleSelectWavetable}
                onTablePrewarm={synthView.handlePrewarmWavetablePicker}
                onRetry={synthView.handleRetryLoad}
                tableFocusBindings={synthView.keyboardRouting.wavetableFocusBindings}
                onPointerDown={synthView.stageBindings.handleStagePointerDown}
                onPointerMove={synthView.stageBindings.handleStagePointerMove}
                onPointerUp={synthView.stageBindings.handleStagePointerUp}
                bottomLeftAccessory={warpControlCluster}
                bottomRightAccessory={panField}
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
        <section
            data-role="keyboard-controls"
            data-section-accent="lime"
            data-liquid-detail="edge-rail"
            className={`${SYNTH_GRID_CARD_SHELL_CLASS} min-w-0 border p-3`}
        >
            {keyboardToolbarOverride}
        </section>
        </>
    );

    const modulationWorkspace = (
        <>
            {mobileReturnSection ? (
                <nav className="mobile-mod-return-bar" aria-label="Modulation source navigation">
                    <button
                        type="button"
                        data-role="mobile-workspace-back"
                        onClick={returnFromMobileModSource}
                    >
                        <span aria-hidden="true">‹</span>
                        Back to {mobileReturnSection === "fx" ? "FX" : mobileReturnSection === "voice" ? "Voice" : "Mod"}
                    </button>
                </nav>
            ) : null}

            {synthView.failureDetail ? (
                <div className="rounded-[22px] border border-fuchsia-300/15 bg-fuchsia-300/8 px-4 py-3 text-sm text-fuchsia-100/90">
                    {synthView.failureDetail}
                </div>
            ) : null}

            <section className={`grid min-h-0 items-stretch ${isCompactViewport ? "mobile-mod-workspace gap-2" : "gap-4 md:grid-cols-2"}`}>
                <ModulationMatrixSection
                    compact={isCompactViewport}
                    focusedSource={mobileModSource}
                    selectedMsegSlot={synthView.selectedMsegSlot}
                    msegState={synthView.msegState}
                    selectedMsegMorph={synthView.selectedMsegMorph}
                    observedMsegPlayhead={synthView.observedMsegPlayhead}
                    selectedEnvelopeSlot={synthView.selectedEnvelopeSlot}
                    selectedEnvelope={synthView.selectedEnvelope}
                    routes={synthView.routes}
                    onSelectMsegSlot={synthView.handleSelectMsegSlot}
                    onSelectMsegShape={synthView.handleSelectMsegShape}
                    onOpenMsegEditor={synthView.msegEditor.openEditor}
                    onMsegMorphChange={synthView.handleMsegMorphChange}
                    onMsegRateChange={synthView.handleMsegRateChange}
                    onToggleMsegLoop={synthView.handleToggleMsegLoop}
                    onSelectEnvelopeSlot={synthView.handleSelectEnvelopeSlot}
                    onEnvelopeChange={synthView.handleEnvelopeChange}
                    onAddRoute={synthView.handleAddRoute}
                    onRemoveRoute={synthView.handleRemoveRoute}
                    onRouteChange={synthView.handleRouteChange}
                    msegRateFocusBindings={synthView.keyboardRouting.msegRateFocusBindings}
                />

                {isCompactViewport ? (
                    <MobileModMatrix
                        routes={synthView.routes}
                        focusedSource={mobileModSource}
                        onCreateRoute={synthView.handleAddRouteWithOverrides}
                        onRemoveRoute={synthView.handleRemoveRoute}
                        onRouteChange={synthView.handleRouteChange}
                    />
                ) : (
                    <section
                        data-role="mod-matrix-card"
                        data-layout-card="desktop-grid-card"
                        data-section-accent="amber"
                        data-liquid-detail="edge-rail"
                        className={`flex flex-col ${SYNTH_GRID_CARD_SHELL_CLASS} border p-4 ${DESKTOP_GRID_CARD_CLASS}`}
                    >
                        <DesktopModMatrix
                            routes={synthView.routes}
                            onAddRoute={synthView.handleAddRoute}
                            onRemoveRoute={synthView.handleRemoveRoute}
                            onRouteChange={synthView.handleRouteChange}
                        />
                    </section>
                )}
            </section>

        </>
    );

    const isMobileEffectsPage = isCompactViewport && mobileWorkspaceSection === "fx";
    const globalModSourceActivity = globalModRailState.selectedSource.sourceKind === "mseg"
        && synthView.observedMsegPlayhead.hasActive
        ? synthView.observedMsegPlayhead.progress
        : null;
    const effectsRackWorkspace = (
        <EffectsRackWorkspace
            routes={synthView.routes}
            observedFilterSpectrum={synthView.observedFilterSpectrum}
            observedDistortionHistory={synthView.observedDistortionHistory}
            observedDistortionScope={synthView.observedDistortionScope}
            onAddRouteWithOverrides={synthView.handleAddRouteWithOverrides}
            onRemoveRoute={synthView.handleRemoveRoute}
            onRouteChange={synthView.handleRouteChange}
            onOpenModSource={openMobileModSource}
            onGlobalModRailStateChange={setGlobalModRailState}
            onSelectedEffectChange={setSelectedRackEffectId}
            mobileGlobalModRail={isCompactViewport}
            mobileModRailPortalTarget={mobileModRailPortalTarget}
            globalModSourceActivity={globalModSourceActivity}
            onBackToVoice={() => {
                if (isCompactViewport) {
                    setMobileWorkspaceSection("voice");
                    return;
                }
                scrollRegionRef.current?.scrollTo({ top: 0, behavior: "smooth" });
            }}
        />
    );

    return (
        <div className={`cosimo-surface relative flex h-full w-full flex-col gap-3 overflow-hidden rounded-[28px] border border-white/[0.05] px-4 pb-4 pt-2.5 text-slate-100${isCompactViewport ? " is-mobile-accordion" : ""}${isMobileEffectsPage ? " is-mobile-effects-page" : ""}`}>
            {!isCompactViewport ? <StatusHeader statusText={synthView.topStatus} /> : null}
            <SynthPresetBarHost
                isHidden={synthView.msegEditor.isOpen}
                storedStateAdapters={synthView.presetStoredStateAdapters}
            />

            {isCompactViewport ? (
                <MobileWorkspaceAccordion
                    activeSection={mobileWorkspaceSection}
                    onSelectSection={selectMobileWorkspaceSection}
                    voice={voiceWorkspace}
                    effects={(
                        <div data-role="mobile-effects-region" className="min-h-0 h-full overflow-hidden">
                            {effectsRackWorkspace}
                        </div>
                    )}
                    modulation={modulationWorkspace}
                />
            ) : (
                <main
                    ref={scrollRegionRef}
                    data-role="desktop-scroll-region"
                    className="grid min-h-0 flex-1 auto-rows-max gap-4 overflow-x-hidden overflow-y-auto pr-1"
                >
                    {voiceWorkspace}
                    {effectsRackWorkspace}
                    {modulationWorkspace}
                </main>
            )}

            {isCompactViewport ? (
                <div
                    ref={setMobileModRailPortalTarget}
                    data-role="mobile-global-mod-rail-portal"
                    className="mobile-global-mod-rail-portal"
                    aria-hidden={false}
                />
            ) : null}

            <div
                data-role="sticky-keyboard"
                className="relative z-20 min-w-0 shrink-0 border-t border-white/[0.05] pt-3"
            >
                <KeyboardSection
                    playMode={synthView.playMode}
                    glideTime={synthView.glideTime}
                    unisonVoices={synthView.unisonVoices}
                    unisonDetune={synthView.unisonDetune}
                    unisonBlend={synthView.unisonBlend}
                    unisonWidth={synthView.unisonWidth}
                    unisonPhase={synthView.unisonPhase}
                    unisonRandom={synthView.unisonRandom}
                    unisonPhaseMode={synthView.unisonPhaseMode}
                    unisonDetuneMode={synthView.unisonDetuneMode}
                    unisonStackMode={synthView.unisonStackMode}
                    unisonWavetablePositionSpread={synthView.unisonWavetablePositionSpread}
                    unisonWarpSpread={synthView.unisonWarpSpread}
                    observedUnisonState={synthView.observedUnisonState}
                    keyboardRootNote={keyboardRootNote}
                    noteCount={isCompactViewport ? 18 : DEFAULT_KEYBOARD_NOTE_COUNT}
                    onOctaveDown={handleKeyboardOctaveDown}
                    onOctaveUp={handleKeyboardOctaveUp}
                    playModeFocusBindings={synthView.keyboardRouting.playModeFocusBindings}
                    glideFocusTarget={synthView.keyboardRouting.glideFocusTarget}
                    keyboardRef={keyboardElementRef}
                    toolbarOverride={false}
                />
            </div>

            <MsegEditorModal
                isOpen={synthView.msegEditor.isOpen}
                slotLabel={`MSEG ${synthView.selectedMsegSlot + 1}`}
                msegState={synthView.msegState}
                morphBinding={synthView.selectedMsegMorph}
                surfaceRef={msegEditorSurfaceRef}
                selectedPointIndex={synthView.msegEditor.selectedPointIndex}
                hoveredSegmentIndex={synthView.msegEditor.hoveredSegmentIndex}
                activeSegmentIndex={synthView.msegEditor.activeSegmentIndex}
                canUndo={synthView.msegEditor.canUndo}
                onClose={synthView.msegEditor.closeEditor}
                onUndo={synthView.msegEditor.undoLastEdit}
                onSelectShape={synthView.handleSelectMsegShape}
                onMorphChange={synthView.handleMsegMorphChange}
                onRateChange={synthView.handleMsegRateChange}
                onToggleLoop={synthView.handleToggleMsegLoop}
                onPointerDown={synthView.msegEditor.handlePointerDown}
                onPointerMove={synthView.msegEditor.handlePointerMove}
                onPointerLeave={synthView.msegEditor.handlePointerLeave}
                onPointerUp={synthView.msegEditor.handlePointerUp}
                rateFocusBindings={synthView.keyboardRouting.msegRateFocusBindings}
            />

            <ContextualArticulationToolbar
                articulationIsDirty={synthView.selectedArticulationIsDirty}
                selectedArticulationName={selectedArticulationName}
                isDismissed={Boolean(contextualToolbarKey && dismissedContextualToolbarKey === contextualToolbarKey)}
                onDismiss={() => {
                    if (contextualToolbarKey) {
                        setDismissedContextualToolbarKey(contextualToolbarKey);
                    }
                }}
                onUpdateArticulation={synthView.handleUpdateSelectedArticulationSlot}
                onSaveAsNewArticulation={() => synthView.handleCaptureArticulationSlot({ autoAssign: true })}
                onRevertArticulation={synthView.handleRevertSelectedArticulationSlot}
            />

            {curveLab.panel}
        </div>
    );
}

export function DesktopPatchView({
    patchConnection,
    resourceClient,
    keyboardInputMode = "hosted",
}: {
    patchConnection: PatchConnectionLike;
    resourceClient?: ResourceClient;
    keyboardInputMode?: SynthKeyboardInputMode;
}) {
    return (
        <PatchConnectionProvider patchConnection={patchConnection} resourceClient={resourceClient}>
            <DesktopPatchViewBody keyboardInputMode={keyboardInputMode} />
        </PatchConnectionProvider>
    );
}
