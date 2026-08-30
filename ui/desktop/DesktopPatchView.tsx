import {
    Suspense,
    lazy,
    useCallback,
    useEffect,
    useLayoutEffect,
    useMemo,
    useRef,
    useState,
    useSyncExternalStore,
    type ReactNode,
    type CSSProperties,
    type KeyboardEvent as ReactKeyboardEvent,
    type PointerEvent as ReactPointerEvent,
    type RefObject,
} from "react";
import { createPortal } from "react-dom";
import {
    WORKSPACE_SHELL_STORAGE_KEY,
    activateTab,
    createHomeShellState,
    openDeepLink,
    parseStoredShellState,
    serializeShellState,
    tapActiveTab,
    universalBack,
    universalBackTarget,
    WORKSPACE_TAB_IDS,
    type WorkspaceShellState,
    type WorkspaceTabId,
} from "../shared/workspace-shell";
import { MobileWorkspaceTabs } from "./mobile-workspace-tabs";
import {
    PatchConnectionProvider,
    usePatchConnection,
    type PatchConnectionLike,
} from "../shared/cmajor-react";
import { useBounceInPlace } from "../shared/use-bounce-in-place";
import {
    BounceActionControl,
    BounceSampledSourceStage,
} from "../shared/bounce-source-stage";
import {
    isVideoBounceAvailable,
    VideoBounceFlow,
} from "./video-bounce-flow";
import type { ResourceClient } from "../shared/resource-client";
import {
    usePatchParameterBinding,
    type PatchControlBinding,
} from "../shared/patch-controls";
import {
    OSCILLATOR_IDS,
    type OscillatorID,
    type OscillatorModulationParameterKind,
    type OscillatorModulationTargetKind,
    type ModulationTargetKind,
} from "../shared/modulation-targets";
import {
    OSCILLATOR_DEFAULT_VOLUME_DB,
    OSCILLATOR_VOLUME_MAX_DB,
    OSCILLATOR_VOLUME_MIN_DB,
} from "../shared/oscillator-defaults";
import {
    getModulationTargetDescriptor,
    type EffectModuleId,
} from "../shared/target-descriptor";
import {
    type SynthFocusBindings,
    type SynthKeyboardInputMode,
} from "../shared/synth-input-router";
import {
    MSEG_RATE_MAX_SECONDS,
    MSEG_RATE_MIN_SECONDS,
    clampMsegRateSeconds,
    type MsegState,
    type MsegSurfaceOrientation,
} from "../shared/mseg";
import {
    EditableMsegSurface,
    FilterResponseGraph,
    type FilterEndpointState,
    type FilterModulationTravel,
    type FilterTravelEndpointSide,
    type FilterTravelGestureSide,
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
import {
    BaseParameterKnob,
    ModulatedParameterKnob,
    RackParameterKnob,
    type ParameterKnobDescriptor,
} from "./rack-parameter-knob";
import {
    ParameterHudLayerContext,
    ParameterHudSuppressionProvider,
    useParameterHudSuppression,
    type ParameterHudVisualization,
} from "../shared/parameter-hud";
import {
    formatParameterEntry,
    parameterEntrySpecForFrequency,
    parameterEntrySpecForKeyTrackModulationAmount,
    parameterEntrySpecForKeyTrackOffset,
    parameterEntrySpecForMobileVoiceControl,
    parameterEntrySpecForScalar,
    parameterEntrySpecForModulationAmount,
    parameterEntrySpecForRackParameter,
    parameterEntrySpecForSeconds,
    parseParameterEntry,
    type ParameterEntrySpec,
} from "../shared/parameter-value-entry";
import {
    ParameterMenuContext,
    useParameterMenu,
    type ParameterMenuRequest,
} from "../shared/parameter-context-menu";
import {
    EDITOR_HIT_RADIUS_PX,
    EDITOR_VALUE_HANDLE_RADIUS_PX,
    useEditorSurfaceSize,
} from "../shared/editor-tokens";
import {
    applyRollingAxisSample,
    createRollingAxisState,
    type RollingAxis,
    type RollingAxisPointerType,
    type RollingAxisState,
} from "../shared/rolling-axis-classifier";
import { useParameterMenuShell } from "../shared/parameter-menu-shell";
import { clearUiTimeout, uiTimeout } from "../shared/ui-timers";
import type { RackParameterDescriptor } from "../shared/rack-parameter-descriptors";
import { findRackModulationSource } from "../shared/rack-modulation-sources";
import { VOICE_FILTER_KNOB_DESCRIPTORS } from "../shared/voice-filter-descriptors";
import { VoiceEnhancerGraph } from "../shared/voice-enhancer-graph";
import {
    VOICE_ENHANCER_AMOUNT_TARGET_KIND,
    VOICE_ENHANCER_FREQUENCY_TARGET_KIND,
    VOICE_ENHANCER_KEY_TRACK_CONTROL_ID,
    VOICE_ENHANCER_KEY_TRACK_OFFSET_ENDPOINT_ID,
    VOICE_ENHANCER_PARAMETER_DESCRIPTORS,
    VOICE_ENHANCER_Q_TARGET_KIND,
    VOICE_ENHANCER_RATIO_MAX_SEMITONES,
    VOICE_ENHANCER_RATIO_MIN_SEMITONES,
    denormalizeVoiceEnhancerValue,
    formatVoiceEnhancerRatio,
    normalizeVoiceEnhancerRatio,
    normalizeVoiceEnhancerValue,
    voiceEnhancerRatioFromSemitones,
    voiceEnhancerRatioSemitonesFromNormalized,
    type VoiceEnhancerParameterDescriptor,
} from "../shared/voice-enhancer";
import { presentRouteWithCanonicalAmount, useModulationRouteAmountBinding } from "../shared/modulation-route-amount";
import {
    MOBILE_VOICE_OWNER_ACCENT,
    MobileVoiceFocusedEditor,
    type MobileVoiceEditorBindings,
} from "../shared/mobile-voice-editor";
import { MobileQuickSourceSheet } from "./mobile-quick-source-sheet";
import { MsegEditorControlStrip } from "./mseg-editor-controls";
import { MsegEditorShell } from "./mseg-editor-shell";
import { useDesktopCurveLab } from "./desktop-curve-lab";
import {
    DesktopOscillatorConnectionBoundary,
    DesktopOscillatorPresentation,
} from "./desktop-oscillator-presentation";
import { DesktopModMatrix } from "./desktop-mod-matrix";
import { MobileModWorkspacePager } from "./mobile-mod-workspace-pager";
import { MobileModMappingsPanel } from "./mobile-mod-mappings-panel";
import {
    EffectsRackWorkspace,
    type GlobalModRailState,
    type ModRailAuditionBindings,
    type ModRailVoiceSettings,
} from "./effects-rack-workspace";
import {
    AUTO_PREVIEW_ENABLED_STORAGE_KEY,
    parseStoredAutoPreviewEnabled,
    serializeAutoPreviewEnabled,
} from "../shared/audition-preferences";
import { PERF_TUNING_AVAILABLE } from "../shared/perf-tuning";
import {
    getModBarPreferences,
    subscribeModBarPreferences,
} from "../shared/mod-bar-preferences";
import {
    GLOBAL_TUNE_ENDPOINT_ID,
    GLOBAL_TUNE_INITIAL_SEMITONES,
    GLOBAL_TUNE_MAX_SEMITONES,
    GLOBAL_TUNE_MIN_SEMITONES,
    GLOBAL_TUNE_STEP_SEMITONES,
    GLOBAL_TUNE_TARGET_KIND,
    formatSemitonesAndCents,
} from "../shared/global-tune";
import {
    getKeyTrackDefinition,
    keyTrackRouteAmountFromSemitones,
    keyTrackRouteAmountToSemitones,
    requireKeyTrackRange,
} from "../shared/key-track";

// Compile-time split so ordinary production builds (flag false) never contain
// the tuning page; Vite dev and the opted-in Codex Sites build do.
const PerfTuningPage = PERF_TUNING_AVAILABLE
    ? lazy(() => import("./perf-tuning-page"))
    : null;
import {
    GLIDE_TIME_MAX_SECONDS,
    GLIDE_TIME_MIN_SECONDS,
    GLIDE_TIME_STEP_SECONDS,
    SYNTH_PRESET_EFFECT_ID,
    useOscillatorSelectionViewModel,
    useSynthPatchViewModel,
    type SynthCallbackControlReadiness,
    type SynthPatchViewModel,
} from "../shared/synth-hooks";
import { createPresetBar } from "../shared/effects/preset-bar";
import { createStandaloneEffectPresetController } from "../shared/effects/standalone-effect-presets";
import { createSynthPresetInitOptions } from "../shared/effects/synth-init-state";
import { buildSynthPresetMigrations } from "../shared/effects/synth-preset-migrations";
import type { EffectStoredStateAdapter } from "../shared/effects/effect-preset-v2";
import { clearLaneSoloAudition } from "../shared/lane-solo-audition";
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
    clampModulationRouteAmount,
    isVoiceModulationSource,
    type ModulationRoute,
    type ModulationRouteUpdate,
} from "../shared/modulation";
import type { RackModulationSource } from "../shared/rack-modulation-sources";

const KEYBOARD_ROOT_NOTE_DEFAULT = 36;
const KEYBOARD_ROOT_NOTE_MIN = 12;
const KEYBOARD_ROOT_NOTE_MAX = 72;
const ENVELOPE_TIME_MIN_SECONDS = 0.001;
const ENVELOPE_TIME_MAX_SECONDS = 10;
const AMP_ENVELOPE_EDITOR_SLOT_INDEX = MODULATION_ENV_SLOT_COUNT;
const ENVELOPE_EDITOR_SLOT_COUNT = MODULATION_ENV_SLOT_COUNT + 1;
// The envelope draws to time (Operator-style): attack, decay, and release
// share the width in proportion to a sublinear warp of their actual times
// (t^0.45 keeps a 1ms attack grabbable beside a 10s release), sustain is a
// slim fixed column (it has no time dimension), and the whole envelope
// always fills the plot. Because the layout renormalizes, horizontal drags
// are relative in log-time: each pixel multiplies the current value by a
// constant factor, so short times get proportionally fine control.
const ENVELOPE_TIME_WARP = 0.45;
const ENVELOPE_SUSTAIN_COLUMN_RATIO = 0.12;
const ENVELOPE_SUSTAIN_COLUMN_MIN_PX = 24;
const ENVELOPE_SUSTAIN_COLUMN_MAX_PX = 64;
const ENVELOPE_PHASE_MIN_WIDTH_PX = 10;
const ENVELOPE_DRAG_EFOLD_PX = 48;
const ENVELOPE_PLOT_PADDING_PX = EDITOR_HIT_RADIUS_PX + 2;
const ENVELOPE_MAX_PLOT_HEIGHT_TO_WIDTH_RATIO = 0.62;
const ENVELOPE_HANDLE_INNER_RADIUS_PX = 3.5;
const ENVELOPE_HANDLE_STROKE_WIDTH_PX = 2.5;
const ENVELOPE_VALUE_BUBBLE_EDGE_INSET_PX = 56;
const ENVELOPE_VALUE_BUBBLE_FINGER_GAP_PX = 14;
const DESKTOP_GRID_CARD_CLASS = `w-full ${SYNTH_GRID_CARD_SIZE_CLASS}`;
const DESKTOP_VOICE_VISUALIZATION_CARD_CLASS = `w-full ${SYNTH_GRID_CARD_SIZE_CLASS} md:aspect-[3/1]`;
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
const UNISON_VOICES_ENTRY_SPEC = parameterEntrySpecForMobileVoiceControl("unisonVoices");
const UNISON_DETUNE_ENTRY_SPEC = parameterEntrySpecForMobileVoiceControl("unisonDetune");
const UNISON_BLEND_ENTRY_SPEC = parameterEntrySpecForMobileVoiceControl("unisonBlend");
const UNISON_WIDTH_ENTRY_SPEC = parameterEntrySpecForMobileVoiceControl("unisonWidth");
const UNISON_PHASE_ENTRY_SPEC = parameterEntrySpecForMobileVoiceControl("phase");
const UNISON_RANDOM_ENTRY_SPEC = parameterEntrySpecForMobileVoiceControl("phaseRandom");
const UNISON_WAVETABLE_SPREAD_ENTRY_SPEC = parameterEntrySpecForMobileVoiceControl("unisonWavetablePositionSpread");
const UNISON_WARP_SPREAD_ENTRY_SPEC = parameterEntrySpecForMobileVoiceControl("unisonWarpSpread");
const FILTER_CUTOFF_ENTRY_SPEC = parameterEntrySpecForFrequency({
    minHz: FILTER_CUTOFF_MIN_HZ,
    maxHz: FILTER_CUTOFF_MAX_HZ,
    stepHz: 0,
    allowLogPercent: true,
});
const VOICE_FILTER_KEY_TRACK_DEFINITION = getKeyTrackDefinition("voice.filterCutoff");
if (VOICE_FILTER_KEY_TRACK_DEFINITION === null) {
    throw new Error("Voice filter cutoff is missing its Key Track definition.");
}
const VOICE_FILTER_KEY_TRACK_RANGE = requireKeyTrackRange(
    VOICE_FILTER_KEY_TRACK_DEFINITION.family);
const FILTER_KEY_TRACK_OFFSET_ENTRY_SPEC = parameterEntrySpecForKeyTrackOffset(
    VOICE_FILTER_KEY_TRACK_DEFINITION.family);
const FILTER_KEY_TRACK_ROUTE_ENTRY_SPEC = parameterEntrySpecForKeyTrackModulationAmount(
    VOICE_FILTER_KEY_TRACK_DEFINITION.family, "octaves");
const VOICE_FILTER_KEY_TRACK_DESCRIPTOR: RackParameterDescriptor = Object.freeze({
    ...VOICE_FILTER_KNOB_DESCRIPTORS.cutoff,
    label: "Key Track Offset",
    shortLabel: "Offset",
    min: VOICE_FILTER_KEY_TRACK_RANGE.knobMin,
    max: VOICE_FILTER_KEY_TRACK_RANGE.knobMax,
    initial: 0,
    step: VOICE_FILTER_KEY_TRACK_RANGE.step,
    scale: "linear",
    unit: "st",
    modulationApplication: "linear",
});
const FILTER_RESONANCE_ENTRY_SPEC = parameterEntrySpecForScalar({
    min: FILTER_Q_MIN,
    max: FILTER_Q_MAX,
    step: 0.01,
    unit: "Q",
    digits: 2,
});
const VOICE_ENHANCER_KEY_TRACK_DEFINITION = getKeyTrackDefinition(
    VOICE_ENHANCER_KEY_TRACK_CONTROL_ID,
);
if (VOICE_ENHANCER_KEY_TRACK_DEFINITION === null) {
    throw new Error("Voice Enhancer Frequency is missing its Key Track definition.");
}
const VOICE_ENHANCER_KEY_TRACK_RANGE = requireKeyTrackRange(
    VOICE_ENHANCER_KEY_TRACK_DEFINITION.family,
);
const VOICE_ENHANCER_RATIO_ENTRY_SPEC = parameterEntrySpecForScalar({
    min: 0.5,
    max: 32,
    step: 0.001,
    unit: "x",
    digits: 3,
});
const VOICE_ENHANCER_KEY_TRACK_ROUTE_ENTRY_SPEC = parameterEntrySpecForKeyTrackModulationAmount(
    VOICE_ENHANCER_KEY_TRACK_DEFINITION.family,
    "octaves",
);
const VOICE_ENHANCER_RATIO_KNOB_DESCRIPTOR: ParameterKnobDescriptor = Object.freeze({
    endpointID: VOICE_ENHANCER_KEY_TRACK_OFFSET_ENDPOINT_ID,
    label: "Ratio",
    shortLabel: "Ratio",
    min: VOICE_ENHANCER_RATIO_MIN_SEMITONES,
    max: VOICE_ENHANCER_RATIO_MAX_SEMITONES,
    initial: 0,
    step: VOICE_ENHANCER_KEY_TRACK_RANGE.step,
    scale: "linear",
});
const PAN_ENTRY_SPEC = parameterEntrySpecForMobileVoiceControl("pan");
const GLOBAL_TUNE_ENTRY_SPEC = parameterEntrySpecForScalar({
    min: GLOBAL_TUNE_MIN_SEMITONES,
    max: GLOBAL_TUNE_MAX_SEMITONES,
    step: GLOBAL_TUNE_STEP_SEMITONES,
    unit: "st",
    digits: 2,
});
const GLOBAL_TUNE_KNOB_DESCRIPTOR: ParameterKnobDescriptor = Object.freeze({
    endpointID: GLOBAL_TUNE_ENDPOINT_ID,
    label: "Global Tune",
    shortLabel: "Global Tune",
    min: GLOBAL_TUNE_MIN_SEMITONES,
    max: GLOBAL_TUNE_MAX_SEMITONES,
    initial: GLOBAL_TUNE_INITIAL_SEMITONES,
    step: GLOBAL_TUNE_STEP_SEMITONES,
    scale: "linear",
});

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

function oscillatorModulationTargetKind(
    oscillatorID: OscillatorID,
    parameterKind: OscillatorModulationParameterKind,
): OscillatorModulationTargetKind {
    return `osc${oscillatorID}.${parameterKind}`;
}

type VoiceGlideSectionProps = {
    playMode: PatchControlBinding<number>;
    glideTime: PatchControlBinding<number>;
};

type FilterSectionProps = {
    filterMode: PatchControlBinding<number>;
    filterCutoff: PatchControlBinding<number>;
    filterCutoffKeyTrackEnabled: PatchControlBinding<number>;
    filterCutoffKeyTrackOffsetSemitones: PatchControlBinding<number>;
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
    /** T05 compact mode: attached knob row, forced round-bars, Off greys all. */
    compact?: boolean;
    filterMix?: PatchControlBinding<number>;
    routes?: ModulationRoute[];
    armedSource?: MobileModSource;
};

type VoiceToneSectionProps = FilterSectionProps & {
    voiceEnhancerFrequency: PatchControlBinding<number>;
    voiceEnhancerQ: PatchControlBinding<number>;
    voiceEnhancerAmount: PatchControlBinding<number>;
    voiceEnhancerKeyTrackEnabled: PatchControlBinding<number>;
    voiceEnhancerKeyTrackOffsetSemitones: PatchControlBinding<number>;
};

type MsegEditorModalProps = {
    isOpen: boolean;
    compactShellBack: boolean;
    slotIndex: number;
    slotLabel: string;
    msegState: MsegState | null;
    morphBinding: PatchControlBinding<number>;
    rateBinding: PatchControlBinding<number>;
    surfaceRef: RefObject<SVGSVGElement | null>;
    selectedPointIndex: number;
    hoveredSegmentIndex: number;
    activeSegmentIndex: number;
    canUndo: boolean;
    onClose: () => void;
    onUndo: () => void;
    onSelectShape: (shapeIndex: number) => void;
    onToggleLoop: () => void;
    onPointerDown: (event: ReactPointerEvent<SVGSVGElement>) => void;
    onPointerMove: (event: ReactPointerEvent<SVGSVGElement>) => void;
    onPointerLeave: (event: ReactPointerEvent<SVGSVGElement>) => void;
    onPointerUp: (event: ReactPointerEvent<SVGSVGElement>) => void;
    rateFocusBindings: SynthFocusBindings;
    orientation: MsegSurfaceOrientation;
    onOrientationChange: (orientation: MsegSurfaceOrientation) => void;
    routes: ReadonlyArray<ModulationRoute>;
    armedSource: {
        readonly sourceKind: ModulationRoute["sourceKind"];
        readonly sourceSlot: number | null;
        readonly shortLabel: string;
        readonly accent: string;
    } | null;
    resolveScrollLockTargets: () => ReadonlyArray<HTMLElement>;
    onRequestParameterMenu: (request: ParameterMenuRequest) => void;
};

type ModulationMatrixSectionProps = {
    compact?: boolean;
    focusedSource?: MobileModSource | null;
    /** Compact only: the floating Mod bar's selection — the page shares it (T14). */
    armedSource?: GlobalModRailState["selectedSource"] | null;
    onArmSource?: (source: GlobalModRailState["selectedSource"]) => void;
    selectedMsegSlot: number;
    msegState: MsegState | null;
    selectedMsegMorph: PatchControlBinding<number>;
    callbackControlReadiness: SynthCallbackControlReadiness;
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
    /** T14 compact SOURCE panel: direct point editing on the graph. The
        handlers are the FULL editor's own (one shape-editing brain); the
        shared surface ref is claimed just-in-time on pointer-down because
        the full-screen editor reuses the same ref while it is open. */
    msegDirectEditing?: {
        sharedSurfaceRef: RefObject<SVGSVGElement | null>;
        selectedPointIndex: number;
        hoveredSegmentIndex: number;
        activeSegmentIndex: number;
        onPointerDown: (event: ReactPointerEvent<SVGSVGElement>) => void;
        onPointerMove: (event: ReactPointerEvent<SVGSVGElement>) => void;
        onPointerLeave: (event: ReactPointerEvent<SVGSVGElement>) => void;
        onPointerUp: (event: ReactPointerEvent<SVGSVGElement>) => void;
    } | null;
};

type EnvelopeEntryField = "attackSeconds" | "decaySeconds" | "sustain" | "releaseSeconds";

type EnvelopeEntryParameter = {
    readonly label: string;
    readonly compactLabel: string;
    readonly ariaLabel: string;
    readonly field: EnvelopeEntryField;
    readonly target: string;
    readonly draft: string;
    readonly setDraft: (nextValue: string) => void;
    readonly current: number;
};

function envelopeEntryParameter(parameter: EnvelopeEntryParameter): EnvelopeEntryParameter {
    return parameter;
}

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

function envelopeTimeEntrySpec(currentSeconds: number, minSeconds = ENVELOPE_TIME_MIN_SECONDS) {
    return parameterEntrySpecForSeconds({
        minSeconds,
        maxSeconds: ENVELOPE_TIME_MAX_SECONDS,
        stepSeconds: 0.001,
        currentSeconds,
    });
}

const ENVELOPE_SUSTAIN_ENTRY_SPEC = parameterEntrySpecForScalar({
    min: 0,
    max: 1,
    step: 0.001,
    unit: "%",
    canonicalPerDisplayedUnit: 0.01,
    digits: 1,
});

function clamp(value: number, min: number, max: number) {
    return Math.min(Math.max(value, min), max);
}

/** Width share of one time phase: a sublinear warp of its actual seconds. */
function envelopeTimeShare(seconds: number, minSeconds = ENVELOPE_TIME_MIN_SECONDS) {
    return Math.pow(
        clamp(seconds, minSeconds, ENVELOPE_TIME_MAX_SECONDS),
        ENVELOPE_TIME_WARP,
    );
}

/** Relative log-time drag: dx pixels multiply the anchored seconds. */
function dragEnvelopeSeconds(
    anchorSeconds: number,
    deltaPx: number,
    minSeconds = ENVELOPE_TIME_MIN_SECONDS,
) {
    const anchored = clamp(anchorSeconds, minSeconds, ENVELOPE_TIME_MAX_SECONDS);
    return clamp(
        anchored * Math.exp(deltaPx / ENVELOPE_DRAG_EFOLD_PX),
        minSeconds,
        ENVELOPE_TIME_MAX_SECONDS,
    );
}

function envelopeReleaseMinimumSeconds(slotIndex: number): number {
    const targetKind = slotIndex === AMP_ENVELOPE_EDITOR_SLOT_INDEX
        ? "ampRelease"
        : `env${slotIndex + 1}Release` as ModulationTargetKind;
    const descriptor = getModulationTargetDescriptor(targetKind);
    if (descriptor.format.kind !== "time") {
        throw new Error(`${descriptor.label} has no envelope-time range.`);
    }
    return descriptor.format.minSeconds;
}

function computeEnvelopeGeometry(
    envelope: NonNullable<ModulationMatrixSectionProps["selectedEnvelope"]>,
    releaseMinimumSeconds: number,
    surfaceSize: { readonly width: number; readonly height: number },
) {
    const surfaceWidth = Math.max(1, surfaceSize.width);
    const surfaceHeight = Math.max(1, surfaceSize.height);
    const horizontalPadding = Math.min(ENVELOPE_PLOT_PADDING_PX, surfaceWidth * 0.25);
    const verticalPadding = Math.min(ENVELOPE_PLOT_PADDING_PX, surfaceHeight * 0.25);
    const plotLeft = horizontalPadding;
    const plotRight = Math.max(plotLeft + 0.5, surfaceWidth - horizontalPadding);
    const plotWidth = Math.max(0.5, plotRight - plotLeft);
    const availablePlotHeight = Math.max(0.5, surfaceHeight - (verticalPadding * 2));
    const plotHeight = Math.min(
        availablePlotHeight,
        Math.max(0.5, plotWidth * ENVELOPE_MAX_PLOT_HEIGHT_TO_WIDTH_RATIO),
    );
    const plotTop = (surfaceHeight - plotHeight) * 0.5;
    const plotBottom = plotTop + plotHeight;

    // One shared time axis: A, D, and R widths are proportional to the
    // warped times, sustain is a slim fixed column, and the envelope always
    // fills the plot. Every phase keeps a minimum grabbable width.
    const sustainWidth = Math.min(
        clamp(plotWidth * ENVELOPE_SUSTAIN_COLUMN_RATIO, ENVELOPE_SUSTAIN_COLUMN_MIN_PX, ENVELOPE_SUSTAIN_COLUMN_MAX_PX),
        plotWidth * 0.5,
    );
    const timeWidth = Math.max(1, plotWidth - sustainWidth);
    const attackShare = envelopeTimeShare(envelope.attackSeconds);
    const decayShare = envelopeTimeShare(envelope.decaySeconds);
    const releaseShare = envelopeTimeShare(envelope.releaseSeconds, releaseMinimumSeconds);
    const totalShare = Math.max(1e-6, attackShare + decayShare + releaseShare);
    const phaseMinWidth = Math.min(ENVELOPE_PHASE_MIN_WIDTH_PX, timeWidth / 3);
    const flexibleWidth = Math.max(0, timeWidth - (phaseMinWidth * 3));
    const attackRegionWidth = phaseMinWidth + (flexibleWidth * (attackShare / totalShare));
    const decayRegionWidth = phaseMinWidth + (flexibleWidth * (decayShare / totalShare));
    const releaseRegionWidth = phaseMinWidth + (flexibleWidth * (releaseShare / totalShare));

    const attackX = plotLeft + attackRegionWidth;
    const decayRegionStart = attackX;
    const decayX = decayRegionStart + decayRegionWidth;
    const noteOffX = decayX + sustainWidth;
    const releaseX = noteOffX + releaseRegionWidth;
    const sustainY = plotTop + ((1 - clamp(envelope.sustain, 0, 1)) * plotHeight);

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
        plotHeight,
        plotBottom,
        plotTop,
        plotLeft,
        plotRight,
        surfaceWidth,
        surfaceHeight,
    };
}

type EnvelopeDragTarget = "attack" | "decay-sustain" | "sustain" | "release";

type EnvelopeEditableField = "attackSeconds" | "decaySeconds" | "sustain" | "releaseSeconds";

type ActiveEnvelopeDrag = {
    readonly target: EnvelopeDragTarget;
    readonly pointerId: number;
    readonly pointerType: RollingAxisPointerType;
    readonly captureElement: SVGElement;
    readonly removeCaptureLossListener: () => void;
    classifier: RollingAxisState;
    lockedAxis: RollingAxis | null;
    lastValues: Record<EnvelopeEditableField, number>;
    // Relative log-time drags anchor at the gesture start (or, for the
    // decay/sustain handle, at the moment the horizontal axis locks) so the
    // value never jumps to meet the pointer.
    anchorClientX: number;
    anchorSeconds: number;
};

type EnvelopeValueBubble = {
    readonly field: EnvelopeEditableField;
    readonly text: string;
    readonly left: number;
    readonly top: number;
};

function envelopePointerType(pointerType: string): RollingAxisPointerType {
    if (pointerType === "touch") {
        return "touch";
    }
    if (pointerType === "pen") {
        return "pen";
    }
    return "mouse";
}

function formatEnvelopeBubbleValue(
    field: EnvelopeEditableField,
    value: number,
    releaseMinimumSeconds: number,
): string {
    if (field === "sustain") {
        return formatParameterEntry(ENVELOPE_SUSTAIN_ENTRY_SPEC, value).display;
    }
    const minimumSeconds = field === "releaseSeconds"
        ? releaseMinimumSeconds
        : ENVELOPE_TIME_MIN_SECONDS;
    return formatParameterEntry(envelopeTimeEntrySpec(value, minimumSeconds), value).display;
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

function formatResonanceDisplay(value: number) {
    const safeValue = Math.min(Math.max(Number(value) || FILTER_Q_MIN, FILTER_Q_MIN), FILTER_Q_MAX);
    return safeValue.toFixed(safeValue >= 10 ? 1 : 2);
}

function formatMixDisplay(value: number) {
    return `${Math.round(Math.min(Math.max(Number(value) || 0, 0), 1) * 100)}%`;
}

/** The Voice filter card's violet section accent (synth-style-guide). */
const VOICE_FILTER_OWNER_ACCENT = "#a98cff";

/**
 * T04A: the armed source's filter travel, per axis. The travel start is the
 * filter at source = 0 (base for a unipolar axis, the mirrored offset for a
 * bipolar one); the end is the filter at full deflection. Endpoints clamp
 * to the audible parameter ranges.
 */
function buildFilterModulationTravel(args: {
    baseCutoffHz: number;
    baseQ: number;
    cutoffAmountOctaves: number;
    qAmountOffset: number;
    cutoffBipolar: boolean;
    qBipolar: boolean;
    cutoffEditable: boolean;
    qEditable: boolean;
    accent: string;
    cutoffAmountLabel?: string;
    cutoffRouteStorageAmount?: number;
}): FilterModulationTravel {
    const clampHz = (hz: number) => Math.min(FILTER_CUTOFF_MAX_HZ, Math.max(FILTER_CUTOFF_MIN_HZ, hz));
    const clampQ = (q: number) => Math.min(FILTER_Q_MAX, Math.max(FILTER_Q_MIN, q));
    // A routed unipolar axis makes base the travel START, not its center:
    // the base handle adopts start semantics and the dedicated center grip
    // takes over translation.
    const anyRoutedUnipolar = (args.cutoffEditable && !args.cutoffBipolar)
        || (args.qEditable && !args.qBipolar);

    return {
        start: {
            cutoffHz: clampHz(args.cutoffBipolar
                ? args.baseCutoffHz * (2 ** -args.cutoffAmountOctaves)
                : args.baseCutoffHz),
            q: clampQ(args.qBipolar ? args.baseQ - args.qAmountOffset : args.baseQ),
        },
        end: {
            cutoffHz: clampHz(args.baseCutoffHz * (2 ** args.cutoffAmountOctaves)),
            q: clampQ(args.baseQ + args.qAmountOffset),
        },
        accent: args.accent,
        cutoffEditable: args.cutoffEditable,
        qEditable: args.qEditable,
        showStartHandle: args.cutoffBipolar || args.qBipolar,
        baseHandleMode: anyRoutedUnipolar ? "start" : "translate",
        centerHandle: anyRoutedUnipolar,
        cutoffAmountLabel: args.cutoffAmountLabel,
        cutoffRouteStorageAmount: args.cutoffRouteStorageAmount,
    };
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
    disabled = false,
    children,
}: {
    ariaLabel: string;
    title: string;
    dataRole?: string;
    onClick: () => void;
    disabled?: boolean;
    children: ReactNode;
}) {
    return (
        <button
            data-role={dataRole}
            type="button"
            aria-label={ariaLabel}
            title={title}
            disabled={disabled}
            className={`flex h-5 w-5 items-center justify-center ${SYNTH_COMPACT_CONTROL_CHROME_CLASS} text-[var(--section-accent)] opacity-80 transition hover:opacity-100 disabled:cursor-wait disabled:opacity-40`}
            onClick={onClick}
        >
            {children}
        </button>
    );
}

function MsegMorphRail({
    binding,
    modulationTargetKind,
    onChange,
    onAdjustingChange,
    className,
}: {
    binding: PatchControlBinding<number>;
    modulationTargetKind: ModulationTargetKind;
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
        if (!rail || !bindingRef.current.isReady) {
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
            className={`cosimo-mseg-morph-control flex items-center gap-2 rounded-[8px] border px-2.5 py-2 ${binding.isReady ? "" : "opacity-45"} ${className ?? ""}`}
            data-role="mseg-morph-control"
            data-host-state={binding.isReady ? "ready" : "loading"}
            aria-busy={!binding.isReady}
        >
            <span className="shrink-0 text-[9px] font-bold uppercase tracking-[0.14em] text-slate-300/55">Morph</span>
            <div
                ref={railRef}
                role="slider"
                aria-disabled={!binding.isReady}
                aria-label="MSEG morph"
                aria-valuemin={0}
                aria-valuemax={1}
                aria-valuenow={Number(value.toFixed(3))}
                aria-valuetext={`${Math.round(value * 100)}%`}
                data-role="mseg-morph-slider"
                data-host-state={binding.isReady ? "ready" : "loading"}
                data-modulation-target-kind={modulationTargetKind}
                className={`relative h-5 min-w-[132px] flex-1 touch-none rounded-full outline-none ${binding.isReady ? "cursor-ew-resize" : "cursor-wait"}`}
                onPointerDown={(event) => {
                    if (!bindingRef.current.isReady || event.button !== 0) {
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
            <span className="cosimo-readout is-caps w-10 shrink-0 text-right opacity-85">
                {value.toFixed(3)}
            </span>
        </div>
    );
}

function WarpControlCluster({
    oscillatorID,
    warpMode,
    warpAmount,
}: {
    oscillatorID: OscillatorID;
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
                data-host-state={warpMode.isReady ? "ready" : "loading"}
                disabled={!warpMode.isReady}
                className="flex h-5 min-w-[72px] items-center gap-1 rounded-[4px] px-1 text-left transition hover:bg-white/[0.06] disabled:cursor-wait disabled:opacity-45"
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
                entrySpec={parameterEntrySpecForMobileVoiceControl("warpAmount")}
                variant="compactOverlay"
                showLabel={false}
                width={62}
                height={20}
                dataRole="warp-amount-field"
                modulationTargetKind={oscillatorModulationTargetKind(oscillatorID, "warpAmount")}
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
            data-host-state={binding.isReady ? "ready" : "loading"}
            disabled={!binding.isReady}
            className="grid h-10 min-w-0 rounded-[10px] border border-white/[0.07] bg-black/28 px-2 py-1 text-left transition hover:bg-white/[0.045] disabled:cursor-wait disabled:opacity-45"
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
    oscillatorID,
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
    oscillatorID: OscillatorID;
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
                        data-host-state={unisonVoices.isReady ? "ready" : "loading"}
                        disabled={!unisonVoices.isReady}
                        className="grid size-7 place-items-center rounded-[9px] border border-white/[0.07] bg-black/30 text-slate-200/80 hover:bg-white/[0.045]"
                        onClick={() => unisonVoices.commitValue(clamp(unisonVoices.value - 1, 1, 8))}
                        aria-label="Decrease unison voices"
                    >
                        -
                    </button>
                    <PrecisionNumberField
                        ariaLabel="Unison voices"
                        binding={unisonVoices}
                        entrySpec={UNISON_VOICES_ENTRY_SPEC}
                        suffix={UNISON_VOICES_ENTRY_SPEC.defaultUnit}
                        width={58}
                        height={30}
                        dataRole="unison-voices-control"
                    />
                    <button
                        type="button"
                        data-role="unison-voices-up"
                        data-host-state={unisonVoices.isReady ? "ready" : "loading"}
                        disabled={!unisonVoices.isReady}
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
                                entrySpec={UNISON_DETUNE_ENTRY_SPEC}
                                suffix={UNISON_DETUNE_ENTRY_SPEC.defaultUnit}
                                width={82}
                                height={30}
                                dataRole="unison-detune-control"
                                modulationTargetKind={oscillatorModulationTargetKind(oscillatorID, "unisonDetune")}
                            />
                        </UnisonField>
                        <UnisonField label="Blend">
                            <PrecisionNumberField
                                ariaLabel="Unison blend"
                                binding={unisonBlend}
                                entrySpec={UNISON_BLEND_ENTRY_SPEC}
                                suffix={UNISON_BLEND_ENTRY_SPEC.defaultUnit}
                                width={82}
                                height={30}
                                dataRole="unison-blend-control"
                                modulationTargetKind={oscillatorModulationTargetKind(oscillatorID, "unisonBlend")}
                            />
                        </UnisonField>
                        <UnisonField label="Width">
                            <PrecisionNumberField
                                ariaLabel="Unison width"
                                binding={unisonWidth}
                                entrySpec={UNISON_WIDTH_ENTRY_SPEC}
                                suffix={UNISON_WIDTH_ENTRY_SPEC.defaultUnit}
                                width={82}
                                height={30}
                                dataRole="unison-width-control"
                                modulationTargetKind={oscillatorModulationTargetKind(oscillatorID, "unisonWidth")}
                            />
                        </UnisonField>
                    </div>
                    <div className="grid grid-cols-3 gap-1.5">
                        <UnisonField label="Phase">
                            <PrecisionNumberField
                                ariaLabel="Unison phase"
                                binding={unisonPhase}
                                entrySpec={UNISON_PHASE_ENTRY_SPEC}
                                suffix={UNISON_PHASE_ENTRY_SPEC.defaultUnit}
                                width={82}
                                height={30}
                                dataRole="unison-phase-control"
                            />
                        </UnisonField>
                        <UnisonField label="Random">
                            <PrecisionNumberField
                                ariaLabel="Unison random"
                                binding={unisonRandom}
                                entrySpec={UNISON_RANDOM_ENTRY_SPEC}
                                suffix={UNISON_RANDOM_ENTRY_SPEC.defaultUnit}
                                width={82}
                                height={30}
                                dataRole="unison-random-control"
                            />
                        </UnisonField>
                        <UnisonField label="WT Pos">
                            <PrecisionNumberField
                                ariaLabel="Unison wavetable position spread"
                                binding={unisonWavetablePositionSpread}
                                entrySpec={UNISON_WAVETABLE_SPREAD_ENTRY_SPEC}
                                suffix={UNISON_WAVETABLE_SPREAD_ENTRY_SPEC.defaultUnit}
                                width={82}
                                height={30}
                                dataRole="unison-wt-spread-control"
                                modulationTargetKind={oscillatorModulationTargetKind(
                                    oscillatorID,
                                    "unisonWavetablePositionSpread",
                                )}
                            />
                        </UnisonField>
                    </div>
                    <div className="grid grid-cols-[82px_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)] gap-1.5">
                        <UnisonField label="Warp">
                            <PrecisionNumberField
                                ariaLabel="Unison warp spread"
                                binding={unisonWarpSpread}
                                entrySpec={UNISON_WARP_SPREAD_ENTRY_SPEC}
                                suffix={UNISON_WARP_SPREAD_ENTRY_SPEC.defaultUnit}
                                width={82}
                                height={30}
                                dataRole="unison-warp-spread-control"
                                modulationTargetKind={oscillatorModulationTargetKind(oscillatorID, "unisonWarpSpread")}
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
    readiness,
    releaseMinimumSeconds,
}: {
    selectedEnvelope: NonNullable<ModulationMatrixSectionProps["selectedEnvelope"]>;
    onEnvelopeChange: ModulationMatrixSectionProps["onEnvelopeChange"];
    readiness: SynthCallbackControlReadiness["envelope"];
    releaseMinimumSeconds: number;
    compact?: boolean;
}) {
    const svgRef = useRef<SVGSVGElement | null>(null);
    const surfaceSize = useEditorSurfaceSize(svgRef);
    const activeDragRef = useRef<ActiveEnvelopeDrag | null>(null);
    const [activeHandle, setActiveHandle] = useState<EnvelopeDragTarget | null>(null);
    const [activeField, setActiveField] = useState<EnvelopeEditableField | null>(null);
    const [valueBubble, setValueBubble] = useState<EnvelopeValueBubble | null>(null);

    const geometry = useMemo(
        () => computeEnvelopeGeometry(selectedEnvelope, releaseMinimumSeconds, surfaceSize),
        [releaseMinimumSeconds, selectedEnvelope, surfaceSize],
    );
    const geometryRef = useRef(geometry);
    const readinessRef = useRef(readiness);
    const selectedEnvelopeRef = useRef(selectedEnvelope);
    const onEnvelopeChangeRef = useRef(onEnvelopeChange);
    const releaseMinimumSecondsRef = useRef(releaseMinimumSeconds);
    geometryRef.current = geometry;
    readinessRef.current = readiness;
    selectedEnvelopeRef.current = selectedEnvelope;
    onEnvelopeChangeRef.current = onEnvelopeChange;
    releaseMinimumSecondsRef.current = releaseMinimumSeconds;

    const isHandleReady = useCallback((handleName: EnvelopeDragTarget) => {
        const currentReadiness = readinessRef.current;
        if (handleName === "attack") return currentReadiness.attackSeconds;
        if (handleName === "decay-sustain") {
            return currentReadiness.decaySeconds && currentReadiness.sustain;
        }
        if (handleName === "sustain") return currentReadiness.sustain;
        return currentReadiness.releaseSeconds;
    }, []);
    const allFieldsReady = readiness.attackSeconds
        && readiness.decaySeconds
        && readiness.sustain
        && readiness.releaseSeconds;

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
        const currentGeometry = geometryRef.current;

        return {
            x: normalizedX * currentGeometry.surfaceWidth,
            y: normalizedY * currentGeometry.surfaceHeight,
        };
    }, []);

    const showValueBubble = useCallback((
        field: EnvelopeEditableField,
        value: number,
        clientX: number,
        clientY: number,
    ) => {
        if (typeof window === "undefined") {
            return;
        }
        const viewportWidth = Math.max(1, window.innerWidth);
        const viewportHeight = Math.max(1, window.innerHeight);
        const left = clamp(
            clientX,
            ENVELOPE_VALUE_BUBBLE_EDGE_INSET_PX,
            Math.max(ENVELOPE_VALUE_BUBBLE_EDGE_INSET_PX, viewportWidth - ENVELOPE_VALUE_BUBBLE_EDGE_INSET_PX),
        );
        const top = clamp(
            clientY - ENVELOPE_VALUE_BUBBLE_FINGER_GAP_PX,
            40,
            Math.max(40, viewportHeight - 8),
        );
        setValueBubble({
            field,
            text: formatEnvelopeBubbleValue(field, value, releaseMinimumSecondsRef.current),
            left,
            top,
        });
    }, []);

    const clearActiveDrag = useCallback(() => {
        const activeDrag = activeDragRef.current;
        activeDragRef.current = null;
        if (activeDrag !== null) {
            activeDrag.removeCaptureLossListener();
            try {
                if (activeDrag.captureElement.hasPointerCapture(activeDrag.pointerId)) {
                    activeDrag.captureElement.releasePointerCapture(activeDrag.pointerId);
                }
            } catch {
                // Pointer capture may already be gone after cancellation.
            }
        }
        setActiveHandle(null);
        setActiveField(null);
        setValueBubble(null);
    }, []);

    const writeEnvelopeValue = useCallback((
        drag: ActiveEnvelopeDrag,
        field: EnvelopeEditableField,
        nextValue: number,
        clientX: number,
        clientY: number,
    ) => {
        const previousValue = drag.lastValues[field];
        if (Math.abs(nextValue - previousValue) > 1e-9) {
            drag.lastValues[field] = nextValue;
            onEnvelopeChangeRef.current(field, nextValue);
        }
        showValueBubble(field, nextValue, clientX, clientY);
    }, [showValueBubble]);

    const handlePointerMove = useCallback((event: PointerEvent) => {
        const drag = activeDragRef.current;
        if (drag === null || event.pointerId !== drag.pointerId) {
            return;
        }
        if (!isHandleReady(drag.target)) {
            clearActiveDrag();
            return;
        }

        if (event.pointerType === "mouse" && event.buttons === 0) {
            clearActiveDrag();
            return;
        }
        event.preventDefault();

        if (drag.target === "decay-sustain" && drag.lockedAxis === null) {
            const classified = applyRollingAxisSample(drag.classifier, {
                x: event.clientX,
                y: event.clientY,
                time: Number(event.timeStamp) || performance.now(),
                pointerType: drag.pointerType,
            });
            drag.classifier = classified.state;
            if (classified.transition !== "activate" || classified.state.mode === "pending") {
                return;
            }
            drag.lockedAxis = classified.state.mode;
            if (classified.state.mode === "horizontal") {
                drag.anchorClientX = event.clientX;
                drag.anchorSeconds = drag.lastValues.decaySeconds;
            }
            const field = classified.state.mode === "horizontal" ? "decaySeconds" : "sustain";
            setActiveField(field);
            showValueBubble(field, drag.lastValues[field], event.clientX, event.clientY);
        }

        if (drag.target === "attack") {
            writeEnvelopeValue(
                drag,
                "attackSeconds",
                dragEnvelopeSeconds(drag.anchorSeconds, event.clientX - drag.anchorClientX),
                event.clientX,
                event.clientY,
            );
            return;
        }

        if (drag.target === "release") {
            writeEnvelopeValue(
                drag,
                "releaseSeconds",
                dragEnvelopeSeconds(
                    drag.anchorSeconds,
                    event.clientX - drag.anchorClientX,
                    releaseMinimumSecondsRef.current,
                ),
                event.clientX,
                event.clientY,
            );
            return;
        }

        if (drag.target === "sustain" || drag.lockedAxis === "vertical") {
            const point = readStagePoint(event.clientX, event.clientY);
            if (point === null) {
                return;
            }
            const currentGeometry = geometryRef.current;
            const sustain = clamp(
                1 - ((point.y - currentGeometry.plotTop) / Math.max(0.5, currentGeometry.plotHeight)),
                0,
                1,
            );
            writeEnvelopeValue(drag, "sustain", sustain, event.clientX, event.clientY);
            return;
        }

        writeEnvelopeValue(
            drag,
            "decaySeconds",
            dragEnvelopeSeconds(drag.anchorSeconds, event.clientX - drag.anchorClientX),
            event.clientX,
            event.clientY,
        );
    }, [clearActiveDrag, isHandleReady, readStagePoint, showValueBubble, writeEnvelopeValue]);

    useEffect(() => {
        const handlePointerUp = (event: PointerEvent) => {
            if (activeDragRef.current?.pointerId === event.pointerId) {
                clearActiveDrag();
            }
        };
        const handlePointerCancel = (event: PointerEvent) => {
            if (activeDragRef.current?.pointerId === event.pointerId) {
                clearActiveDrag();
            }
        };

        const handleVisibilityChange = () => {
            if (document.visibilityState !== "visible") {
                clearActiveDrag();
            }
        };

        window.addEventListener("pointermove", handlePointerMove, { passive: false });
        window.addEventListener("pointerup", handlePointerUp, true);
        window.addEventListener("pointercancel", handlePointerCancel, true);
        window.addEventListener("blur", clearActiveDrag);
        window.addEventListener("resize", clearActiveDrag);
        window.addEventListener("orientationchange", clearActiveDrag);
        document.addEventListener("visibilitychange", handleVisibilityChange);

        return () => {
            window.removeEventListener("pointermove", handlePointerMove);
            window.removeEventListener("pointerup", handlePointerUp, true);
            window.removeEventListener("pointercancel", handlePointerCancel, true);
            window.removeEventListener("blur", clearActiveDrag);
            window.removeEventListener("resize", clearActiveDrag);
            window.removeEventListener("orientationchange", clearActiveDrag);
            document.removeEventListener("visibilitychange", handleVisibilityChange);
            clearActiveDrag();
        };
    }, [clearActiveDrag, handlePointerMove]);

    const beginHandleDrag = useCallback((
        handleName: EnvelopeDragTarget,
        event: ReactPointerEvent<SVGElement>,
    ) => {
        if (activeDragRef.current !== null) {
            return;
        }
        if (event.button !== 0) {
            return;
        }
        if (!isHandleReady(handleName)) {
            return;
        }
        event.preventDefault();
        event.stopPropagation();
        const envelope = selectedEnvelopeRef.current;
        const initialField = handleName === "attack"
            ? "attackSeconds"
            : handleName === "release"
                ? "releaseSeconds"
                : handleName === "sustain"
                    ? "sustain"
                    : null;
        const captureElement = event.currentTarget;
        const handleCaptureLoss = () => clearActiveDrag();
        activeDragRef.current = {
            target: handleName,
            pointerId: event.pointerId,
            pointerType: envelopePointerType(event.pointerType),
            captureElement,
            removeCaptureLossListener: () => {
                captureElement.removeEventListener("lostpointercapture", handleCaptureLoss);
            },
            classifier: createRollingAxisState(event.clientX, event.clientY),
            lockedAxis: handleName === "decay-sustain"
                ? null
                : handleName === "sustain"
                    ? "vertical"
                    : "horizontal",
            lastValues: {
                attackSeconds: envelope.attackSeconds,
                decaySeconds: envelope.decaySeconds,
                sustain: envelope.sustain,
                releaseSeconds: envelope.releaseSeconds,
            },
            anchorClientX: event.clientX,
            anchorSeconds: handleName === "attack"
                ? envelope.attackSeconds
                : handleName === "release"
                    ? envelope.releaseSeconds
                    : envelope.decaySeconds,
        };
        captureElement.addEventListener("lostpointercapture", handleCaptureLoss, { once: true });
        setActiveHandle(handleName);
        setActiveField(initialField);
        if (initialField !== null) {
            showValueBubble(initialField, envelope[initialField], event.clientX, event.clientY);
        }
        try {
            captureElement.setPointerCapture(event.pointerId);
        } catch {
            // Window listeners preserve the gesture when capture is rejected.
        }
    }, [clearActiveDrag, isHandleReady, showValueBubble]);

    const rootNode = svgRef.current?.getRootNode();
    const bubblePortalTarget = typeof document === "undefined"
        ? null
        : typeof ShadowRoot !== "undefined" && rootNode instanceof ShadowRoot
            ? rootNode
            : document.body;

    return (
        <div className="relative h-full overflow-hidden bg-[rgb(var(--cosimo-ground-rgb)/0.92)]">
                <svg
                    ref={svgRef}
                    viewBox={`0 0 ${geometry.surfaceWidth} ${geometry.surfaceHeight}`}
                    preserveAspectRatio="none"
                    className="relative z-10 block h-full w-full touch-none"
                    data-role="adsr-editor-surface"
                    data-host-state={allFieldsReady ? "ready" : "loading"}
                    aria-busy={!allFieldsReady}
                    data-active-handle={activeHandle ?? undefined}
                    data-active-field={activeField ?? undefined}
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
                                vectorEffect="non-scaling-stroke"
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
                                vectorEffect="non-scaling-stroke"
                            />
                        );
                    })}

                    <rect
                        x={geometry.plotLeft}
                        y={geometry.plotTop}
                        width={geometry.attackRegionWidth}
                        height={geometry.plotHeight}
                        rx={16}
                        fill="rgb(var(--cosimo-adsr-curve-rgb) / 0.03)"
                    />
                    <rect
                        x={geometry.decayRegionStart}
                        y={geometry.plotTop}
                        width={geometry.decayRegionWidth}
                        height={geometry.plotHeight}
                        rx={16}
                        fill="rgb(var(--cosimo-adsr-curve-rgb) / 0.045)"
                    />
                    <rect
                        x={geometry.noteOffX}
                        y={geometry.plotTop}
                        width={geometry.releaseRegionWidth}
                        height={geometry.plotHeight}
                        rx={16}
                        fill="rgb(var(--cosimo-adsr-curve-rgb) / 0.04)"
                    />

                    <line
                        x1={geometry.noteOffX}
                        y1={geometry.plotTop}
                        x2={geometry.noteOffX}
                        y2={geometry.plotBottom}
                        stroke="rgb(var(--cosimo-adsr-curve-rgb) / 0.72)"
                        strokeWidth={2}
                        strokeDasharray="7 7"
                        vectorEffect="non-scaling-stroke"
                    />

                    <path d={envelopeFillPath} fill="rgb(var(--cosimo-adsr-curve-rgb) / 0.10)" />
                    <path
                        data-role="adsr-curve"
                        d={envelopePath}
                        fill="none"
                        stroke="var(--cosimo-adsr-curve)"
                        strokeWidth={3}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        vectorEffect="non-scaling-stroke"
                    />

                    <line
                        data-role="adsr-sustain-segment-hit-target"
                        x1={geometry.decayX}
                        y1={geometry.sustainY}
                        x2={geometry.noteOffX}
                        y2={geometry.sustainY}
                        stroke="transparent"
                        strokeWidth={EDITOR_HIT_RADIUS_PX * 2}
                        vectorEffect="non-scaling-stroke"
                        className={readiness.sustain ? "cursor-ns-resize" : "cursor-wait"}
                        aria-disabled={!readiness.sustain}
                        style={{ pointerEvents: readiness.sustain ? "stroke" : "none" }}
                        onPointerDown={(event) => beginHandleDrag("sustain", event)}
                        onLostPointerCapture={clearActiveDrag}
                    />

                    <circle
                        data-role="adsr-attack-handle"
                        cx={geometry.attackX}
                        cy={geometry.plotTop}
                        r={EDITOR_VALUE_HANDLE_RADIUS_PX}
                        fill="rgb(var(--cosimo-ground-rgb) / 0.94)"
                        stroke="var(--cosimo-adsr-curve)"
                        strokeWidth={ENVELOPE_HANDLE_STROKE_WIDTH_PX}
                        vectorEffect="non-scaling-stroke"
                    />
                    <circle
                        cx={geometry.attackX}
                        cy={geometry.plotTop}
                        r={ENVELOPE_HANDLE_INNER_RADIUS_PX}
                        fill="var(--cosimo-adsr-curve)"
                    />
                    <circle
                        data-role="adsr-attack-handle-hit-target"
                        cx={geometry.attackX}
                        cy={geometry.plotTop}
                        r={EDITOR_HIT_RADIUS_PX}
                        fill="transparent"
                        className={readiness.attackSeconds ? "cursor-ew-resize" : "cursor-wait"}
                        aria-disabled={!readiness.attackSeconds}
                        style={{ pointerEvents: readiness.attackSeconds ? undefined : "none" }}
                        onPointerDown={(event) => beginHandleDrag("attack", event)}
                        onLostPointerCapture={clearActiveDrag}
                    />

                    <circle
                        data-role="adsr-decay-sustain-handle"
                        cx={geometry.decayX}
                        cy={geometry.sustainY}
                        r={EDITOR_VALUE_HANDLE_RADIUS_PX}
                        fill="rgb(var(--cosimo-ground-rgb) / 0.94)"
                        stroke="var(--cosimo-adsr-curve)"
                        strokeWidth={ENVELOPE_HANDLE_STROKE_WIDTH_PX}
                        vectorEffect="non-scaling-stroke"
                    />
                    <circle
                        cx={geometry.decayX}
                        cy={geometry.sustainY}
                        r={ENVELOPE_HANDLE_INNER_RADIUS_PX}
                        fill="var(--cosimo-adsr-curve)"
                    />
                    <circle
                        data-role="adsr-decay-sustain-handle-hit-target"
                        cx={geometry.decayX}
                        cy={geometry.sustainY}
                        r={EDITOR_HIT_RADIUS_PX}
                        fill="transparent"
                        className={readiness.decaySeconds && readiness.sustain ? "cursor-move" : "cursor-wait"}
                        aria-disabled={!readiness.decaySeconds || !readiness.sustain}
                        style={{ pointerEvents: readiness.decaySeconds && readiness.sustain ? undefined : "none" }}
                        onPointerDown={(event) => beginHandleDrag("decay-sustain", event)}
                        onLostPointerCapture={clearActiveDrag}
                    />

                    <circle
                        data-role="adsr-release-handle"
                        cx={geometry.releaseX}
                        cy={geometry.plotBottom}
                        r={EDITOR_VALUE_HANDLE_RADIUS_PX}
                        fill="rgb(var(--cosimo-ground-rgb) / 0.94)"
                        stroke="var(--cosimo-adsr-curve)"
                        strokeWidth={ENVELOPE_HANDLE_STROKE_WIDTH_PX}
                        vectorEffect="non-scaling-stroke"
                    />
                    <circle
                        cx={geometry.releaseX}
                        cy={geometry.plotBottom}
                        r={ENVELOPE_HANDLE_INNER_RADIUS_PX}
                        fill="var(--cosimo-adsr-curve)"
                    />
                    <circle
                        data-role="adsr-release-handle-hit-target"
                        cx={geometry.releaseX}
                        cy={geometry.plotBottom}
                        r={EDITOR_HIT_RADIUS_PX}
                        fill="transparent"
                        className={readiness.releaseSeconds ? "cursor-ew-resize" : "cursor-wait"}
                        aria-disabled={!readiness.releaseSeconds}
                        style={{ pointerEvents: readiness.releaseSeconds ? undefined : "none" }}
                        onPointerDown={(event) => beginHandleDrag("release", event)}
                        onLostPointerCapture={clearActiveDrag}
                    />
                </svg>
                {valueBubble !== null && bubblePortalTarget !== null ? createPortal(
                    <div
                        data-role="adsr-value-bubble"
                        data-field={valueBubble.field}
                        className="adsr-value-bubble"
                        style={{ left: valueBubble.left, top: valueBubble.top }}
                        role="status"
                        aria-live="off"
                    >
                        {valueBubble.text}
                    </div>,
                    bubblePortalTarget,
                ) : null}
        </div>
    );
}

function StatusHeader({ statusText }: HeaderProps) {
    return (
        <header className="flex items-center justify-between gap-3">
            <span className="text-[10px] font-semibold uppercase tracking-[0.24em] text-blue-300/55">Cosimo Synth</span>
            <span className="text-[10px] uppercase tracking-[0.16em] text-[var(--cosimo-ink-muted)]">{statusText}</span>
        </header>
    );
}

function SynthPresetBarHost({
    isHidden,
    focusedEditorOpen = false,
    storedStateAdapters,
    wavetableTables,
    polishMeter,
    compactSynth = false,
    backAvailable = false,
    onShellBack,
    perfTuningAvailable = false,
    onOpenPerfTuning,
    onBounceGuardReady,
    bounceAudioAvailable,
    onBounceAudio,
    onBounceVideo,
}: {
    isHidden: boolean;
    focusedEditorOpen?: boolean;
    storedStateAdapters: EffectStoredStateAdapter[];
    wavetableTables: SynthPatchViewModel["tableOptions"];
    polishMeter: SynthPatchViewModel["observedPolishMeter"];
    /** ADR-026 compact synth composition: Back slot, centered name, … popover. */
    compactSynth?: boolean;
    backAvailable?: boolean;
    onShellBack?: () => void;
    /** Developer builds only: reveals the shell menu's Developer settings row. */
    perfTuningAvailable?: boolean;
    onOpenPerfTuning?: () => void;
    onBounceGuardReady?: (
        guard: ((continuation: () => void) => void) | null,
    ) => void;
    bounceAudioAvailable: boolean;
    onBounceAudio: () => void;
    onBounceVideo: (patchInput: unknown) => void;
}) {
    const patchConnection = usePatchConnection();
    const hostRef = useRef<HTMLDivElement | null>(null);
    const presetBarRef = useRef<ReturnType<typeof createPresetBar> | null>(null);
    const onShellBackRef = useRef(onShellBack);
    onShellBackRef.current = onShellBack;
    const onOpenPerfTuningRef = useRef(onOpenPerfTuning);
    onOpenPerfTuningRef.current = onOpenPerfTuning;
    const onBounceGuardReadyRef = useRef(onBounceGuardReady);
    onBounceGuardReadyRef.current = onBounceGuardReady;
    const onBounceAudioRef = useRef(onBounceAudio);
    onBounceAudioRef.current = onBounceAudio;
    const onBounceVideoRef = useRef(onBounceVideo);
    onBounceVideoRef.current = onBounceVideo;
    const wavetableTablesRef = useRef(wavetableTables);
    wavetableTablesRef.current = wavetableTables;
    const presetController = useMemo(() => createStandaloneEffectPresetController({
        effectID: SYNTH_PRESET_EFFECT_ID,
        patchConnection,
        storedStateAdapters,
        presetMigrations: buildSynthPresetMigrations,
        synth: createSynthPresetInitOptions(patchConnection, storedStateAdapters, {
            getShippedWavetableTables: () => wavetableTablesRef.current,
        }),
        onSoundReplacementApplied: (replacement) => {
            if (replacement.kind !== "bounce") {
                clearLaneSoloAudition(patchConnection);
            }
        },
    }), [patchConnection, storedStateAdapters]);

    useEffect(() => {
        const host = hostRef.current;

        if (!host) {
            return;
        }

        const presetBar = createPresetBar();
        presetBar.controller = presetController;
        const handleShellBack = () => onShellBackRef.current?.();
        const handleBounceAudio = () => {
            presetBar.requestBounceSoundReplacement(() => onBounceAudioRef.current());
        };
        const handleBounceVideo = (event: Event) => {
            const detail = (event as CustomEvent<{ readonly patchInput: unknown }>).detail;
            onBounceVideoRef.current(detail.patchInput);
        };
        presetBar.addEventListener("cosimo-shell-back", handleShellBack);
        const handleOpenPerfTuning = () => onOpenPerfTuningRef.current?.();
        presetBar.addEventListener("cosimo-open-perf-tuning", handleOpenPerfTuning);
        presetBar.addEventListener("cosimo-bounce-audio", handleBounceAudio);
        presetBar.addEventListener("cosimo-bounce-video", handleBounceVideo);
        presetBarRef.current = presetBar;
        host.replaceChildren(presetBar);
        presetController.attach();
        onBounceGuardReadyRef.current?.((continuation) => {
            presetBar.requestBounceSoundReplacement(continuation);
        });

        return () => {
            onBounceGuardReadyRef.current?.(null);
            presetController.detach();
            presetBar.removeEventListener("cosimo-shell-back", handleShellBack);
            presetBar.removeEventListener("cosimo-open-perf-tuning", handleOpenPerfTuning);
            presetBar.removeEventListener("cosimo-bounce-audio", handleBounceAudio);
            presetBar.removeEventListener("cosimo-bounce-video", handleBounceVideo);
            presetBar.controller = null;
            presetBarRef.current = null;
            presetBar.remove();
        };
    }, [presetController]);

    useEffect(() => {
        const presetBar = presetBarRef.current;
        if (!presetBar) {
            return;
        }
        presetBar.toggleAttribute("compact-synth", compactSynth);
        presetBar.shellBackAvailable = compactSynth && backAvailable;
        presetBar.perfTuningAvailable = perfTuningAvailable;
        presetBar.audioBounceAvailable = bounceAudioAvailable;
        presetBar.videoBounceAvailable = isVideoBounceAvailable();
    }, [backAvailable, bounceAudioAvailable, compactSynth, perfTuningAvailable, presetController]);

    useEffect(() => {
        const presetBar = presetBarRef.current;
        if (presetBar !== null) {
            presetBar.polishMeterFrame = polishMeter;
        }
    }, [polishMeter, presetController]);

    return (
        <div
            ref={hostRef}
            data-role="synth-preset-bar-host"
            hidden={isHidden}
            style={focusedEditorOpen ? { zIndex: 70 } : undefined}
            className={`relative z-40 min-w-0 shrink-0 overflow-visible rounded-[12px] ${
                // The compact shell row is exactly the 40px token: the bar's own
                // chrome is the only border, so the host adds none (ADR-026).
                compactSynth ? "" : "border border-white/[0.06] "
            }bg-black/20 [--knob-track-value-color:#87d7f5] [--preset-bar-border-radius:12px]`}
        />
    );
}

/**
 * T05: the Voice filter's compact knob row uses the shared production knob
 * (ADR-025 dual-ring) bound to the voice filter endpoints. The rack context
 * menu is deliberately not offered here — value editing happens on the knob
 * and modulation feedback on its ring, per the T04 settled list.
 */


function VoiceFilterKnob({
    descriptor,
    binding,
    targetKind,
    routes,
    armedSource,
    disabled,
    formatValue,
    modulationDragStyle,
    presentHudVisualization,
    keyTrackEnabled = false,
    onKeyTrackToggle,
}: {
    descriptor: RackParameterDescriptor;
    binding: PatchControlBinding<number>;
    targetKind: ModulationTargetKind;
    routes: ModulationRoute[];
    armedSource: MobileModSource;
    disabled: boolean;
    formatValue: (value: number) => string;
    modulationDragStyle?: "amount-span" | "effective-value";
    presentHudVisualization?: (value: number) => ParameterHudVisualization;
    keyTrackEnabled?: boolean;
    onKeyTrackToggle?: () => void;
}) {
    const armedRoute = routes.find((route) => (
        route.targetKind === targetKind
        && route.sourceKind === armedSource.sourceKind
        && route.sourceSlot === armedSource.sourceSlot
    )) ?? null;
    const amountBinding = useModulationRouteAmountBinding(armedRoute);
    const canonicalPresentedRoute = presentRouteWithCanonicalAmount(armedRoute, amountBinding);
    const presentedRoute = keyTrackEnabled && canonicalPresentedRoute !== null
        ? {
            ...canonicalPresentedRoute,
            amount: keyTrackRouteAmountToSemitones(canonicalPresentedRoute.amount, "octaves"),
          }
        : canonicalPresentedRoute;
    const sourceDescriptor = findRackModulationSource(armedSource.sourceKind, armedSource.sourceSlot);
    // ADR-025 row 7: Voice knobs report the same real mapping total as FX.
    const targetRouteCount = routes.filter((route) => route.targetKind === targetKind).length;
    const anyTargetRouteEnabled = routes.some((route) => route.targetKind === targetKind && route.enabled);
    const openParameterMenu = useParameterMenu();

    return (
        <div
            className={`mobile-filter-knob-cell${disabled ? " is-disabled" : ""}`}
            data-modulation-target-kind={targetKind}
        >
            {targetRouteCount > 0 ? (
                <span
                    className={`rack-route-count-badge ${anyTargetRouteEnabled ? "is-solid" : "is-hollow"}`}
                    data-role={`voice-filter-route-count-${descriptor.endpointID}`}
                    aria-label={`${targetRouteCount} modulation ${targetRouteCount === 1 ? "route" : "routes"} target ${descriptor.label}`}
                >
                    {targetRouteCount}
                </span>
            ) : null}
            <RackParameterKnob
                descriptor={descriptor}
                binding={binding}
                modulationTargetKind={targetKind}
                formatValue={formatValue}
                ownerAccent={VOICE_FILTER_OWNER_ACCENT}
                modulationDragStyle={modulationDragStyle}
                presentHudVisualization={presentHudVisualization}
                modulationAmountBounds={keyTrackEnabled
                    ? {
                        min: VOICE_FILTER_KEY_TRACK_RANGE.routeMin,
                        max: VOICE_FILTER_KEY_TRACK_RANGE.routeMax,
                      }
                    : undefined}
                formatModulationAmount={keyTrackEnabled
                    ? (amount) => `${Number(amount.toFixed(2))} st`
                    : undefined}
                route={presentedRoute}
                sourceIsSelected
                sourceAccent={sourceDescriptor.accent}
                effectiveness={disabled ? "effect-bypassed" : "active"}
                dataRole={`voice-filter-knob-${descriptor.endpointID}`}
                trackDataRole={`voice-filter-knob-track-${descriptor.endpointID}`}
                handleDataRole={`voice-filter-knob-handle-${descriptor.endpointID}`}
                onSelect={() => {}}
                onModulationAmountChange={(amount) => amountBinding.setValue(
                    keyTrackEnabled
                        ? keyTrackRouteAmountFromSemitones(amount, "octaves")
                        : amount)}
                onRequestContextMenu={(clientX: number, clientY: number) => {
                    openParameterMenu?.({
                        controlKey: descriptor.endpointID,
                        label: keyTrackEnabled ? "Key Track Offset" : descriptor.label,
                        targetKind,
                        baseSpec: keyTrackEnabled
                            ? FILTER_KEY_TRACK_OFFSET_ENTRY_SPEC
                            : parameterEntrySpecForRackParameter(descriptor, binding.value),
                        amountSpec: keyTrackEnabled ? FILTER_KEY_TRACK_ROUTE_ENTRY_SPEC : undefined,
                        baseFieldLabel: keyTrackEnabled ? "Key Track Offset" : undefined,
                        routeDestinationLabel: keyTrackEnabled ? "Key Track Offset" : undefined,
                        baseValue: binding.value,
                        defaultValue: descriptor.initial,
                        commitBase: binding.commitValue,
                        clientX,
                        clientY,
                    });
                }}
            />
            {onKeyTrackToggle !== undefined ? (
                <button
                    type="button"
                    data-role="key-track-filterCutoff"
                    aria-pressed={keyTrackEnabled}
                    className="key-track-button voice-key-track-button is-knob-button"
                    onPointerDown={(event) => event.stopPropagation()}
                    onClick={onKeyTrackToggle}
                >Key Track</button>
            ) : null}
        </div>
    );
}

function GlobalTuneKnob({
    binding,
    routes,
    armedSource,
}: {
    binding: PatchControlBinding<number>;
    routes: ModulationRoute[];
    armedSource: MobileModSource;
}) {
    const armedRoute = routes.find((route) => (
        route.targetKind === GLOBAL_TUNE_TARGET_KIND
        && route.sourceKind === armedSource.sourceKind
        && route.sourceSlot === armedSource.sourceSlot
    )) ?? null;
    const amountBinding = useModulationRouteAmountBinding(armedRoute);
    const presentedRoute = presentRouteWithCanonicalAmount(armedRoute, amountBinding);
    const sourceDescriptor = findRackModulationSource(armedSource.sourceKind, armedSource.sourceSlot);
    const targetRouteCount = routes.filter((route) => route.targetKind === GLOBAL_TUNE_TARGET_KIND).length;
    const anyTargetRouteEnabled = routes.some((route) => (
        route.targetKind === GLOBAL_TUNE_TARGET_KIND && route.enabled
    ));
    const openParameterMenu = useParameterMenu();

    return (
        <div
            className="global-tune-knob-cell"
            data-modulation-target-kind={GLOBAL_TUNE_TARGET_KIND}
        >
            {targetRouteCount > 0 ? (
                <span
                    className={`rack-route-count-badge ${anyTargetRouteEnabled ? "is-solid" : "is-hollow"}`}
                    data-role="global-tune-route-count"
                    aria-label={`${targetRouteCount} modulation ${targetRouteCount === 1 ? "route" : "routes"} target Global Tune`}
                >
                    {targetRouteCount}
                </span>
            ) : null}
            <ModulatedParameterKnob
                descriptor={GLOBAL_TUNE_KNOB_DESCRIPTOR}
                binding={binding}
                modulationApplication="linear"
                modulationTargetKind={GLOBAL_TUNE_TARGET_KIND}
                formatValue={formatSemitonesAndCents}
                ownerAccent={MOBILE_VOICE_OWNER_ACCENT}
                route={presentedRoute}
                sourceIsSelected
                sourceAccent={sourceDescriptor.accent}
                effectiveness="active"
                dataRole="global-tune-knob"
                trackDataRole="global-tune-knob-track"
                handleDataRole="global-tune-knob-handle"
                onSelect={() => {}}
                onModulationAmountChange={(amount) => amountBinding.setValue(amount)}
                onRequestContextMenu={(clientX, clientY) => {
                    openParameterMenu?.({
                        controlKey: GLOBAL_TUNE_ENDPOINT_ID,
                        label: "Global Tune",
                        targetKind: GLOBAL_TUNE_TARGET_KIND,
                        baseSpec: GLOBAL_TUNE_ENTRY_SPEC,
                        baseValue: binding.value,
                        defaultValue: GLOBAL_TUNE_INITIAL_SEMITONES,
                        commitBase: binding.commitValue,
                        clientX,
                        clientY,
                    });
                }}
            />
        </div>
    );
}

function voiceEnhancerEntrySpec(
    descriptor: VoiceEnhancerParameterDescriptor,
): ParameterEntrySpec {
    if (descriptor.unit === "Hz") {
        return parameterEntrySpecForFrequency({
            minHz: descriptor.min,
            maxHz: descriptor.max,
            stepHz: descriptor.step,
            allowLogPercent: true,
        });
    }
    return parameterEntrySpecForScalar({
        min: descriptor.min,
        max: descriptor.max,
        step: descriptor.step,
        unit: descriptor.unit,
        canonicalPerDisplayedUnit: descriptor.unit === "%" ? 0.01 : 1,
        digits: descriptor.unit === "Q" ? 2 : 3,
    });
}

function VoiceEnhancerKnob({
    descriptor,
    binding,
    targetKind,
    routes,
    armedSource,
    formatValue,
    modulationApplication,
    entrySpec,
    keyTrackEnabled = false,
}: {
    descriptor: ParameterKnobDescriptor;
    binding: PatchControlBinding<number>;
    targetKind:
        | typeof VOICE_ENHANCER_FREQUENCY_TARGET_KIND
        | typeof VOICE_ENHANCER_Q_TARGET_KIND
        | typeof VOICE_ENHANCER_AMOUNT_TARGET_KIND;
    routes: ModulationRoute[];
    armedSource: MobileModSource;
    formatValue: (value: number) => string;
    modulationApplication: "linear" | "octaves";
    entrySpec: ParameterEntrySpec;
    keyTrackEnabled?: boolean;
}) {
    const armedRoute = routes.find((route) => (
        route.targetKind === targetKind
        && route.sourceKind === armedSource.sourceKind
        && route.sourceSlot === armedSource.sourceSlot
    )) ?? null;
    const amountBinding = useModulationRouteAmountBinding(armedRoute);
    const canonicalPresentedRoute = presentRouteWithCanonicalAmount(armedRoute, amountBinding);
    const presentedRoute = keyTrackEnabled && canonicalPresentedRoute !== null
        ? {
            ...canonicalPresentedRoute,
            amount: keyTrackRouteAmountToSemitones(canonicalPresentedRoute.amount, "octaves"),
          }
        : canonicalPresentedRoute;
    const sourceDescriptor = findRackModulationSource(armedSource.sourceKind, armedSource.sourceSlot);
    const targetRouteCount = routes.filter((route) => route.targetKind === targetKind).length;
    const anyTargetRouteEnabled = routes.some((route) => (
        route.targetKind === targetKind && route.enabled
    ));
    const openParameterMenu = useParameterMenu();

    return (
        <div
            className="mobile-filter-knob-cell"
            data-modulation-target-kind={targetKind}
        >
            {targetRouteCount > 0 ? (
                <span
                    className={`rack-route-count-badge ${anyTargetRouteEnabled ? "is-solid" : "is-hollow"}`}
                    data-role={`voice-enhancer-route-count-${targetKind}`}
                    aria-label={`${targetRouteCount} modulation ${targetRouteCount === 1 ? "route" : "routes"} target ${descriptor.label}`}
                >
                    {targetRouteCount}
                </span>
            ) : null}
            <ModulatedParameterKnob
                descriptor={descriptor}
                binding={binding}
                modulationApplication={keyTrackEnabled ? "linear" : modulationApplication}
                modulationTargetKind={targetKind}
                formatValue={formatValue}
                ownerAccent="#a78bfa"
                modulationDragStyle={targetKind === VOICE_ENHANCER_Q_TARGET_KIND
                    ? "effective-value"
                    : "amount-span"}
                modulationAmountBounds={keyTrackEnabled
                    ? {
                        min: VOICE_ENHANCER_KEY_TRACK_RANGE.routeMin,
                        max: VOICE_ENHANCER_KEY_TRACK_RANGE.routeMax,
                      }
                    : undefined}
                formatModulationAmount={keyTrackEnabled
                    ? (value) => `${Number(value.toFixed(2))} st`
                    : undefined}
                route={presentedRoute}
                sourceIsSelected
                sourceAccent={sourceDescriptor.accent}
                effectiveness="active"
                dataRole={`voice-enhancer-knob-${descriptor.endpointID}`}
                trackDataRole={`voice-enhancer-knob-track-${descriptor.endpointID}`}
                handleDataRole={`voice-enhancer-knob-handle-${descriptor.endpointID}`}
                onSelect={() => {}}
                onModulationAmountChange={(value) => amountBinding.setValue(
                    keyTrackEnabled
                        ? keyTrackRouteAmountFromSemitones(value, "octaves")
                        : value,
                )}
                onRequestContextMenu={(clientX, clientY) => {
                    const ratioValue = keyTrackEnabled
                        ? voiceEnhancerRatioFromSemitones(binding.value)
                        : binding.value;
                    openParameterMenu?.({
                        controlKey: binding.endpointID,
                        label: descriptor.label,
                        targetKind,
                        baseSpec: entrySpec,
                        amountSpec: keyTrackEnabled
                            ? VOICE_ENHANCER_KEY_TRACK_ROUTE_ENTRY_SPEC
                            : parameterEntrySpecForModulationAmount(targetKind, binding.value),
                        baseFieldLabel: descriptor.label,
                        routeDestinationLabel: descriptor.label,
                        baseValue: ratioValue,
                        defaultValue: keyTrackEnabled ? 1 : descriptor.initial,
                        commitBase: keyTrackEnabled
                            ? (ratio) => binding.commitValue(12 * Math.log2(ratio))
                            : binding.commitValue,
                        clientX,
                        clientY,
                    });
                }}
            />
        </div>
    );
}

function VoiceEnhancerSection({
    frequency,
    q,
    amount,
    keyTrackEnabledBinding,
    keyTrackOffsetSemitones,
    routes,
    armedSource,
    compact,
}: {
    frequency: PatchControlBinding<number>;
    q: PatchControlBinding<number>;
    amount: PatchControlBinding<number>;
    keyTrackEnabledBinding: PatchControlBinding<number>;
    keyTrackOffsetSemitones: PatchControlBinding<number>;
    routes: ModulationRoute[];
    armedSource: MobileModSource;
    compact: boolean;
}) {
    const keyTrackEnabled = keyTrackEnabledBinding.value >= 0.5;
    const displayedFrequency = keyTrackEnabled ? keyTrackOffsetSemitones : frequency;
    const displayedFrequencyDescriptor = keyTrackEnabled
        ? VOICE_ENHANCER_RATIO_KNOB_DESCRIPTOR
        : VOICE_ENHANCER_PARAMETER_DESCRIPTORS.frequency;
    const frequencyNormalized = keyTrackEnabled
        ? normalizeVoiceEnhancerRatio(keyTrackOffsetSemitones.value)
        : normalizeVoiceEnhancerValue(
            VOICE_ENHANCER_PARAMETER_DESCRIPTORS.frequency,
            frequency.value,
        );
    const ready = displayedFrequency.isReady && q.isReady && amount.isReady;
    const toggleKeyTrack = useCallback(() => {
        if (keyTrackEnabled) {
            keyTrackEnabledBinding.commitValue(0);
            return;
        }
        keyTrackEnabledBinding.beginGesture();
        try {
            keyTrackOffsetSemitones.setValue(0);
            keyTrackEnabledBinding.setValue(1);
        } finally {
            keyTrackEnabledBinding.endGesture();
        }
    }, [keyTrackEnabled, keyTrackEnabledBinding, keyTrackOffsetSemitones]);

    return (
        <section
            data-role="voice-enhancer-card"
            data-section-accent="violet"
            className={compact
                ? "mobile-filter-card voice-tone-stage-content h-full"
                : `${SYNTH_GRID_CARD_SHELL_CLASS} flex h-full w-full min-h-0 flex-col overflow-hidden border`}
        >
            {compact ? null : <div className={SYNTH_GRID_CARD_INSET_SHADOW_CLASS} />}
            {compact ? (
                <button
                    type="button"
                    data-role="key-track-voiceEnhancerFrequency-graph"
                    aria-pressed={keyTrackEnabled}
                    className="key-track-button voice-enhancer-key-track-button"
                    onClick={toggleKeyTrack}
                >Key Track</button>
            ) : null}
            <div
                className="relative min-h-0 flex-1"
                data-role="voice-enhancer-graph-drop-surface"
                data-modulation-target-kind={VOICE_ENHANCER_FREQUENCY_TARGET_KIND}
            >
                <div
                    className={`absolute inset-0 p-1.5 ${ready ? "" : "pointer-events-none opacity-45"}`}
                    data-host-state={ready ? "ready" : "loading"}
                    aria-busy={!ready}
                >
                    <VoiceEnhancerGraph
                        frequencyNormalized={frequencyNormalized}
                        q={q.value}
                        amount={amount.value}
                        disabled={!ready}
                        onGestureStart={() => {
                            displayedFrequency.beginGesture();
                            amount.beginGesture();
                        }}
                        onGestureEnd={() => {
                            displayedFrequency.endGesture();
                            amount.endGesture();
                        }}
                        onFrequencyNormalizedChange={(value) => displayedFrequency.setValue(
                            keyTrackEnabled
                                ? voiceEnhancerRatioSemitonesFromNormalized(value)
                                : denormalizeVoiceEnhancerValue(
                                    VOICE_ENHANCER_PARAMETER_DESCRIPTORS.frequency,
                                    value,
                                ),
                        )}
                        onAmountChange={(value) => amount.setValue(value)}
                        className="h-full w-full touch-none"
                    />
                </div>
                {compact ? null : (
                    <button
                        type="button"
                        data-role="key-track-voiceEnhancerFrequency-graph"
                        aria-pressed={keyTrackEnabled}
                        className="key-track-button absolute right-2 top-2 z-20"
                        onClick={toggleKeyTrack}
                    >Key Track</button>
                )}
            </div>
            <div
                data-role="voice-enhancer-knob-row"
                className="mobile-filter-knob-row grid shrink-0 grid-cols-3 gap-1 border-t border-white/[0.07] p-1"
            >
                <VoiceEnhancerKnob
                    descriptor={displayedFrequencyDescriptor}
                    binding={displayedFrequency}
                    targetKind={VOICE_ENHANCER_FREQUENCY_TARGET_KIND}
                    routes={routes}
                    armedSource={armedSource}
                    formatValue={keyTrackEnabled ? formatVoiceEnhancerRatio : formatCutoffDisplay}
                    modulationApplication="octaves"
                    keyTrackEnabled={keyTrackEnabled}
                    entrySpec={keyTrackEnabled
                        ? VOICE_ENHANCER_RATIO_ENTRY_SPEC
                        : voiceEnhancerEntrySpec(VOICE_ENHANCER_PARAMETER_DESCRIPTORS.frequency)}
                />
                <VoiceEnhancerKnob
                    descriptor={VOICE_ENHANCER_PARAMETER_DESCRIPTORS.q}
                    binding={q}
                    targetKind={VOICE_ENHANCER_Q_TARGET_KIND}
                    routes={routes}
                    armedSource={armedSource}
                    formatValue={formatResonanceDisplay}
                    modulationApplication="linear"
                    entrySpec={voiceEnhancerEntrySpec(VOICE_ENHANCER_PARAMETER_DESCRIPTORS.q)}
                />
                <VoiceEnhancerKnob
                    descriptor={VOICE_ENHANCER_PARAMETER_DESCRIPTORS.amount}
                    binding={amount}
                    targetKind={VOICE_ENHANCER_AMOUNT_TARGET_KIND}
                    routes={routes}
                    armedSource={armedSource}
                    formatValue={(value) => `${Math.round(value * 100)}%`}
                    modulationApplication="linear"
                    entrySpec={voiceEnhancerEntrySpec(VOICE_ENHANCER_PARAMETER_DESCRIPTORS.amount)}
                />
            </div>
        </section>
    );
}

function VoiceToneSection(props: VoiceToneSectionProps) {
    const [stage, setStage] = useState<"filter" | "enhancer">("filter");
    const {
        className,
        compact = false,
        voiceEnhancerFrequency,
        voiceEnhancerQ,
        voiceEnhancerAmount,
        voiceEnhancerKeyTrackEnabled,
        voiceEnhancerKeyTrackOffsetSemitones,
        ...filterProps
    } = props;
    if (!filterProps.routes || !filterProps.armedSource) {
        throw new Error("VoiceToneSection requires routes and an armed source.");
    }

    return (
        <div
            data-role="voice-filter-enhancer-footprint"
            data-selected-stage={stage}
            className={`relative min-h-0 ${className ?? ""}`}
        >
            {stage === "filter" ? (
                <FilterSection
                    {...filterProps}
                    compact={compact}
                    className={compact ? "voice-tone-stage-content h-full" : "h-full"}
                />
            ) : (
                <VoiceEnhancerSection
                    frequency={voiceEnhancerFrequency}
                    q={voiceEnhancerQ}
                    amount={voiceEnhancerAmount}
                    keyTrackEnabledBinding={voiceEnhancerKeyTrackEnabled}
                    keyTrackOffsetSemitones={voiceEnhancerKeyTrackOffsetSemitones}
                    routes={filterProps.routes}
                    armedSource={filterProps.armedSource}
                    compact={compact}
                />
            )}
            <div
                data-role="voice-tone-stage-selector"
                className={`voice-tone-stage-selector absolute left-1/2 top-1.5 z-30 flex -translate-x-1/2 overflow-hidden rounded-full border border-white/[0.09] bg-[#080d10]/90 p-0.5 shadow-lg backdrop-blur ${compact ? "is-compact" : ""}`}
            >
                {(["filter", "enhancer"] as const).map((candidate) => (
                    <button
                        key={candidate}
                        type="button"
                        data-role={`voice-tone-stage-${candidate}`}
                        aria-pressed={stage === candidate}
                        className={`voice-tone-stage-button rounded-full px-2 py-0.5 text-[9px] font-semibold tracking-[0.16em] transition ${stage === candidate
                            ? "bg-violet-400/20 text-violet-100"
                            : "text-white/45 hover:text-white/75"}`}
                        onClick={() => setStage(candidate)}
                    >{candidate.toUpperCase()}</button>
                ))}
            </div>
        </div>
    );
}

function FilterSection({
    filterMode,
    filterCutoff,
    filterCutoffKeyTrackEnabled,
    filterCutoffKeyTrackOffsetSemitones,
    filterQ,
    observedFilterState,
    observedFilterSpectrum,
    resonanceNormalizedFromQ,
    resonanceQFromSurface,
    resonanceCurveDebugState,
    className,
    compact = false,
    filterMix,
    routes,
    armedSource,
}: FilterSectionProps) {
    const [spectrumRenderMode, setSpectrumRenderMode] = useState<FilterSpectrumRenderMode>("graph");
    const parameterHudSuppression = useParameterHudSuppression();
    const keyTrackEnabled = filterCutoffKeyTrackEnabled.value >= 0.5;
    const displayedFilterCutoff = keyTrackEnabled
        ? filterCutoffKeyTrackOffsetSemitones
        : filterCutoff;
    const displayedCutoffDescriptor = keyTrackEnabled
        ? VOICE_FILTER_KEY_TRACK_DESCRIPTOR
        : VOICE_FILTER_KNOB_DESCRIPTORS.cutoff;
    const graphBaseCutoffHz = keyTrackEnabled
        ? clamp(
            observedFilterState.cutoffHz,
            FILTER_CUTOFF_MIN_HZ,
            FILTER_CUTOFF_MAX_HZ,
        )
        : filterCutoff.value;
    const toggleKeyTrack = useCallback(() => {
        if (keyTrackEnabled) {
            filterCutoffKeyTrackEnabled.commitValue(0);
            return;
        }
        // One product action: the retained offset is centred while the
        // enabled endpoint owns a single host/user-edit transaction. Host
        // Undo therefore cannot leave Key Track half-enabled.
        filterCutoffKeyTrackEnabled.beginGesture();
        try {
            filterCutoffKeyTrackOffsetSemitones.setValue(0);
            filterCutoffKeyTrackEnabled.setValue(1);
        } finally {
            filterCutoffKeyTrackEnabled.endGesture();
        }
    }, [
        filterCutoffKeyTrackEnabled,
        filterCutoffKeyTrackOffsetSemitones,
        keyTrackEnabled,
    ]);
    const findArmedRoute = (targetKind: "filterCutoffOctaves" | "filterQ") => (routes && armedSource
        ? routes.find((route) => (
            route.targetKind === targetKind
            && route.sourceKind === armedSource.sourceKind
            && route.sourceSlot === armedSource.sourceSlot
        )) ?? null
        : null);
    const armedCutoffRoute = findArmedRoute("filterCutoffOctaves");
    const armedQRoute = findArmedRoute("filterQ");
    const armedCutoffAmount = useModulationRouteAmountBinding(armedCutoffRoute);
    const armedQAmount = useModulationRouteAmountBinding(armedQRoute);
    /** Anchor for one travel drag: the endpoints as they stood at grab time. */
    const travelDragRef = useRef<{
        side: FilterTravelGestureSide;
        baseCutoffHz: number;
        baseQ: number;
        startCutoffHz: number;
        startQ: number;
        endCutoffHz: number;
        endQ: number;
        baseOffsetSemitones: number;
    } | null>(null);

    if (compact) {
        if (!filterMix || !routes || !armedSource) {
            throw new Error("Compact FilterSection requires filterMix, routes, and armedSource.");
        }
        const filterOff = filterMode.value === 0;
        // T04A: the travel overlay renders only while the armed source has a
        // filter mapping — color must never claim a mapping that does not
        // exist. Each axis is live only through its own route.
        const modulationTravel = armedCutoffRoute === null && armedQRoute === null
            ? null
            : buildFilterModulationTravel({
                baseCutoffHz: graphBaseCutoffHz,
                baseQ: filterQ.value,
                cutoffAmountOctaves: armedCutoffRoute === null
                    ? 0
                    : armedCutoffAmount.value ?? armedCutoffRoute.amount,
                qAmountOffset: armedQRoute === null
                    ? 0
                    : armedQAmount.value ?? armedQRoute.amount,
                cutoffBipolar: armedCutoffRoute?.polarity === "bipolar",
                qBipolar: armedQRoute?.polarity === "bipolar",
                cutoffEditable: armedCutoffRoute !== null,
                qEditable: armedQRoute !== null,
                accent: findRackModulationSource(armedSource.sourceKind, armedSource.sourceSlot).accent,
                cutoffAmountLabel: keyTrackEnabled && armedCutoffRoute !== null
                    ? `${Number(keyTrackRouteAmountToSemitones(
                        armedCutoffAmount.value ?? armedCutoffRoute.amount,
                        "octaves",
                    ).toFixed(2))} st`
                    : undefined,
                cutoffRouteStorageAmount: keyTrackEnabled
                    ? armedCutoffAmount.value ?? armedCutoffRoute?.amount
                    : undefined,
            });
        const handleTravelGestureStart = (side: FilterTravelGestureSide) => {
            if (modulationTravel === null) {
                throw new Error("Travel gestures require an armed filter mapping.");
            }
            travelDragRef.current = {
                side,
                baseCutoffHz: graphBaseCutoffHz,
                baseQ: filterQ.value,
                startCutoffHz: modulationTravel.start.cutoffHz,
                startQ: modulationTravel.start.q,
                endCutoffHz: modulationTravel.end.cutoffHz,
                endQ: modulationTravel.end.q,
                baseOffsetSemitones: filterCutoffKeyTrackOffsetSemitones.value,
            };
            // Endpoint drags can rewrite base cutoff/Q, so they bracket host
            // gestures exactly like the base handle does.
            displayedFilterCutoff.beginGesture();
            filterQ.beginGesture();
            parameterHudSuppression.suppress();
        };
        const handleTravelGestureEnd = () => {
            if (travelDragRef.current === null) {
                return;
            }
            travelDragRef.current = null;
            displayedFilterCutoff.endGesture();
            filterQ.endGesture();
            parameterHudSuppression.release();
        };
        const handleTravelEndpointSet = (side: FilterTravelEndpointSide, state: FilterEndpointState) => {
            const anchor = travelDragRef.current;
            if (anchor === null) {
                throw new Error("Travel endpoint edits require an open travel gesture.");
            }
            const setCutoffBaseHz = (nextBaseHz: number) => {
                if (keyTrackEnabled) {
                    filterCutoffKeyTrackOffsetSemitones.setValue(
                        anchor.baseOffsetSemitones
                        + (12 * Math.log2(nextBaseHz / anchor.baseCutoffHz)),
                    );
                    return;
                }
                filterCutoff.setValue(nextBaseHz);
            };

            // Every handle moves independently: the dragged grip follows the
            // pointer and every other grip stays planted, so base and amount
            // co-rewrite per axis. Octave amounts anchor base on the
            // geometric midpoint; linear Q offsets on the arithmetic one.
            const applyCutoff = () => {
                if (armedCutoffRoute === null) {
                    if (side === "base") {
                        setCutoffBaseHz(state.cutoffHz);
                    }
                    return;
                }
                if (armedCutoffRoute.polarity === "bipolar") {
                    if (side === "base") {
                        // Base is the travel center: translation, amount kept.
                        setCutoffBaseHz(state.cutoffHz);
                        return;
                    }
                    const fixedHz = side === "end" ? anchor.startCutoffHz : anchor.endCutoffHz;
                    const nextBaseHz = Math.sqrt(fixedHz * state.cutoffHz);
                    const nextAmount = Math.log2(state.cutoffHz / nextBaseHz) * (side === "end" ? 1 : -1);
                    setCutoffBaseHz(nextBaseHz);
                    armedCutoffAmount.setValue(clampModulationRouteAmount("filterCutoffOctaves", nextAmount));
                    return;
                }
                if (side === "end") {
                    armedCutoffAmount.setValue(clampModulationRouteAmount(
                        "filterCutoffOctaves",
                        Math.log2(state.cutoffHz / anchor.baseCutoffHz),
                    ));
                    return;
                }
                // Unipolar start (the base handle or the mixed-polarity start
                // grip): base follows the pointer and the end stays planted.
                setCutoffBaseHz(state.cutoffHz);
                armedCutoffAmount.setValue(clampModulationRouteAmount(
                    "filterCutoffOctaves",
                    Math.log2(anchor.endCutoffHz / state.cutoffHz),
                ));
            };
            const applyQ = () => {
                if (armedQRoute === null) {
                    if (side === "base") {
                        filterQ.setValue(state.q);
                    }
                    return;
                }
                if (armedQRoute.polarity === "bipolar") {
                    if (side === "base") {
                        filterQ.setValue(state.q);
                        return;
                    }
                    const fixedQ = side === "end" ? anchor.startQ : anchor.endQ;
                    const nextBaseQ = (fixedQ + state.q) / 2;
                    const nextAmount = (state.q - nextBaseQ) * (side === "end" ? 1 : -1);
                    filterQ.setValue(nextBaseQ);
                    armedQAmount.setValue(clampModulationRouteAmount("filterQ", nextAmount));
                    return;
                }
                if (side === "end") {
                    armedQAmount.setValue(clampModulationRouteAmount("filterQ", state.q - anchor.baseQ));
                    return;
                }
                filterQ.setValue(state.q);
                armedQAmount.setValue(clampModulationRouteAmount("filterQ", anchor.endQ - state.q));
            };

            applyCutoff();
            applyQ();
        };
        const handleTravelTranslate = (start: FilterEndpointState, end: FilterEndpointState) => {
            const anchor = travelDragRef.current;
            if (anchor === null) {
                throw new Error("Travel translation requires an open travel gesture.");
            }
            const setCutoffBaseHz = (nextBaseHz: number) => {
                if (keyTrackEnabled) {
                    filterCutoffKeyTrackOffsetSemitones.setValue(
                        anchor.baseOffsetSemitones
                        + (12 * Math.log2(nextBaseHz / anchor.baseCutoffHz)),
                    );
                    return;
                }
                filterCutoff.setValue(nextBaseHz);
            };
            // Rigid screen-space translation: re-derive base + amounts from
            // the translated endpoint pair per each axis's polarity. Amounts
            // may breathe slightly on the nonlinear Q surface — the shape the
            // user is holding is the honest contract.
            if (armedCutoffRoute !== null) {
                if (armedCutoffRoute.polarity === "bipolar") {
                    const nextBaseHz = Math.sqrt(start.cutoffHz * end.cutoffHz);
                    setCutoffBaseHz(nextBaseHz);
                    armedCutoffAmount.setValue(clampModulationRouteAmount(
                        "filterCutoffOctaves",
                        Math.log2(end.cutoffHz / nextBaseHz),
                    ));
                } else {
                    setCutoffBaseHz(start.cutoffHz);
                    armedCutoffAmount.setValue(clampModulationRouteAmount(
                        "filterCutoffOctaves",
                        Math.log2(end.cutoffHz / start.cutoffHz),
                    ));
                }
            } else {
                setCutoffBaseHz(start.cutoffHz);
            }
            if (armedQRoute !== null) {
                if (armedQRoute.polarity === "bipolar") {
                    const nextBaseQ = (start.q + end.q) / 2;
                    filterQ.setValue(nextBaseQ);
                    armedQAmount.setValue(clampModulationRouteAmount("filterQ", end.q - nextBaseQ));
                } else {
                    filterQ.setValue(start.q);
                    armedQAmount.setValue(clampModulationRouteAmount("filterQ", end.q - start.q));
                }
            } else {
                filterQ.setValue(start.q);
            }
        };
        return (
            <section
                data-role="filter-card"
                data-section-accent="violet"
                data-filter-off={filterOff}
                className={`mobile-filter-card ${className ?? ""}`}
            >
                {/* One drop on the graph maps the source to the whole filter:
                    the primary Cutoff destination plus its Q companion. */}
                <div
                    className="mobile-filter-stage"
                    data-role="filter-graph-drop-surface"
                    data-modulation-target-kind="filterCutoffOctaves"
                    data-modulation-target-companions="filterQ"
                >
                <div
                    className={`mobile-filter-graph ${displayedFilterCutoff.isReady && filterQ.isReady ? "" : "pointer-events-none opacity-45"}`}
                    data-disabled={filterOff}
                    data-host-state={displayedFilterCutoff.isReady && filterQ.isReady ? "ready" : "loading"}
                    aria-busy={!displayedFilterCutoff.isReady || !filterQ.isReady}
                >
                    <FilterResponseGraph
                        baseMode={filterMode.value}
                        baseCutoffHz={graphBaseCutoffHz}
                        baseQ={filterQ.value}
                        liveMode={observedFilterState.mode}
                        liveCutoffHz={observedFilterState.cutoffHz}
                        liveQ={observedFilterState.q}
                        liveHasActive={observedFilterState.hasActive}
                        spectrumFrame={observedFilterSpectrum}
                        spectrumRenderMode="round-bars"
                        resonanceNormalizedFromQ={resonanceNormalizedFromQ}
                        resonanceQFromSurface={resonanceQFromSurface}
                        resonanceCurveDebugState={resonanceCurveDebugState}
                        onGestureStart={() => {
                            displayedFilterCutoff.beginGesture();
                            filterQ.beginGesture();
                            parameterHudSuppression.suppress();
                        }}
                        onGestureEnd={() => {
                            displayedFilterCutoff.endGesture();
                            filterQ.endGesture();
                            parameterHudSuppression.release();
                        }}
                        onCutoffSet={(nextValue) => {
                            if (!keyTrackEnabled) filterCutoff.setValue(nextValue);
                        }}
                        onQSet={(nextValue) => filterQ.setValue(nextValue)}
                        modulationTravel={filterOff ? null : modulationTravel}
                        onTravelEndpointSet={handleTravelEndpointSet}
                        onTravelTranslate={handleTravelTranslate}
                        onTravelGestureStart={handleTravelGestureStart}
                        onTravelGestureEnd={handleTravelGestureEnd}
                        className="h-full w-full"
                    />
                </div>
                {/* The Mode chip stays live while Off greys everything else. */}
                <div className="absolute left-1.5 top-1.5 z-10">
                    <OverlayIconChip
                        dataRole="filter-mode-chip"
                        ariaLabel={`Cycle filter mode (currently ${getFilterModeLabel(filterMode.value)})`}
                        title={`Filter mode: ${getFilterModeLabel(filterMode.value)}`}
                        disabled={!filterMode.isReady}
                        onClick={() => filterMode.commitValue(cycleFilterMode(filterMode.value))}
                    >
                        <FilterModeGlyph mode={filterMode.value} />
                    </OverlayIconChip>
                </div>
                </div>
                <div data-role="voice-filter-knob-row" className="mobile-filter-knob-row">
                    <VoiceFilterKnob
                        descriptor={displayedCutoffDescriptor}
                        binding={displayedFilterCutoff}
                        targetKind="filterCutoffOctaves"
                        routes={routes}
                        armedSource={armedSource}
                        disabled={filterOff}
                        formatValue={keyTrackEnabled
                            ? (value) => `${Number(value.toFixed(2))} st`
                            : formatCutoffDisplay}
                        keyTrackEnabled={keyTrackEnabled}
                        presentHudVisualization={keyTrackEnabled ? undefined : (cutoffHz) => ({
                            kind: "filter",
                            mode: filterMode.value,
                            cutoffHz,
                            q: filterQ.value,
                        })}
                        onKeyTrackToggle={toggleKeyTrack}
                    />
                    <VoiceFilterKnob
                        descriptor={VOICE_FILTER_KNOB_DESCRIPTORS.resonance}
                        binding={filterQ}
                        targetKind="filterQ"
                        routes={routes}
                        armedSource={armedSource}
                        disabled={filterOff}
                        formatValue={formatResonanceDisplay}
                        modulationDragStyle="effective-value"
                    />
                    <VoiceFilterKnob
                        descriptor={VOICE_FILTER_KNOB_DESCRIPTORS.mix}
                        binding={filterMix}
                        targetKind="filterMix"
                        routes={routes}
                        armedSource={armedSource}
                        disabled={filterOff}
                        formatValue={formatMixDisplay}
                    />
                </div>
            </section>
        );
    }

    return (
        <section
            data-role="filter-card"
            data-layout-card="desktop-grid-card"
            data-section-accent="violet"
            data-liquid-detail="display-lip"
            className={`${SYNTH_GRID_CARD_SHELL_CLASS} border ${className ?? ""}`}
        >
            <div className={SYNTH_GRID_CARD_INSET_SHADOW_CLASS} />

            <div
                className={`absolute inset-0 p-1.5 ${filterCutoff.isReady && filterQ.isReady ? "" : "pointer-events-none opacity-45"}`}
                data-host-state={filterCutoff.isReady && filterQ.isReady ? "ready" : "loading"}
                aria-busy={!filterCutoff.isReady || !filterQ.isReady}
            >
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
                        parameterHudSuppression.suppress();
                    }}
                    onGestureEnd={() => {
                        filterCutoff.endGesture();
                        filterQ.endGesture();
                        parameterHudSuppression.release();
                    }}
                    onCutoffSet={(nextValue) => {
                        if (!keyTrackEnabled) filterCutoff.setValue(nextValue);
                    }}
                    onQSet={(nextValue) => filterQ.setValue(nextValue)}
                    className="h-full w-full"
                />
            </div>

            <div className="absolute inset-x-0 top-0 z-10 flex items-start justify-between p-1.5">
                <OverlayIconChip
                    dataRole="filter-mode-chip"
                    ariaLabel={`Cycle filter mode (currently ${getFilterModeLabel(filterMode.value)})`}
                    title={`Filter mode: ${getFilterModeLabel(filterMode.value)}`}
                    disabled={!filterMode.isReady}
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
                <div className="pointer-events-auto flex flex-col items-start gap-0.5">
                    <PrecisionNumberField
                        ariaLabel={keyTrackEnabled ? "Key Track Offset" : "Filter cutoff"}
                        binding={displayedFilterCutoff}
                        entrySpec={keyTrackEnabled
                            ? FILTER_KEY_TRACK_OFFSET_ENTRY_SPEC
                            : FILTER_CUTOFF_ENTRY_SPEC}
                        suffix={keyTrackEnabled ? "st" : FILTER_CUTOFF_ENTRY_SPEC.defaultUnit}
                        normalizedFromValue={keyTrackEnabled
                            ? (value) => (value - VOICE_FILTER_KEY_TRACK_RANGE.knobMin)
                                / (VOICE_FILTER_KEY_TRACK_RANGE.knobMax - VOICE_FILTER_KEY_TRACK_RANGE.knobMin)
                            : filterCutoffHzToNormalized}
                        valueFromNormalized={keyTrackEnabled
                            ? (normalized) => VOICE_FILTER_KEY_TRACK_RANGE.knobMin
                                + (normalized * (VOICE_FILTER_KEY_TRACK_RANGE.knobMax
                                    - VOICE_FILTER_KEY_TRACK_RANGE.knobMin))
                            : normalizedToFilterCutoffHz}
                        pixelsPerFullRange={220}
                        dataRole="filter-cutoff-field"
                        modulationTargetKind="filterCutoffOctaves"
                        menuLabel={keyTrackEnabled ? "Key Track Offset" : undefined}
                        menuAmountSpec={keyTrackEnabled ? FILTER_KEY_TRACK_ROUTE_ENTRY_SPEC : undefined}
                        menuBaseFieldLabel={keyTrackEnabled ? "Key Track Offset" : undefined}
                        menuRouteDestinationLabel={keyTrackEnabled ? "Key Track Offset" : undefined}
                        variant="compactOverlay"
                        width={72}
                        height={22}
                    />
                    <button
                        type="button"
                        data-role="key-track-filterCutoff"
                        aria-pressed={keyTrackEnabled}
                        className="key-track-button voice-key-track-button"
                        onClick={toggleKeyTrack}
                    >Key Track</button>
                </div>
                <div className="pointer-events-auto">
                    <PrecisionNumberField
                        ariaLabel="Filter resonance"
                        binding={filterQ}
                        entrySpec={FILTER_RESONANCE_ENTRY_SPEC}
                        suffix={FILTER_RESONANCE_ENTRY_SPEC.defaultUnit}
                        normalizedFromValue={resonanceNormalizedFromQ}
                        valueFromNormalized={resonanceQFromSurface}
                        pixelsPerFullRange={180}
                        dataRole="filter-resonance-field"
                        modulationTargetKind="filterQ"
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
                        disabled={!filterMode.isReady}
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

function OscillatorPerformanceControls({
    oscillatorID,
    octave,
    semitone,
    fineCents,
    volumeDb,
    mute,
    solo,
    inactive = false,
}: {
    oscillatorID: OscillatorID;
    octave: PatchControlBinding<number>;
    semitone: PatchControlBinding<number>;
    fineCents: PatchControlBinding<number>;
    volumeDb: PatchControlBinding<number>;
    mute: PatchControlBinding<number>;
    solo: PatchControlBinding<number>;
    inactive?: boolean;
}) {
    // The engine has ONE pitch MOD destination (semitones); SEMI alone
    // presents and receives it. OCT and FINE are base-only knobs — showing
    // the same route on all three read as three independent mappings.
    const fields = [
        { label: "Oscillator octave", shortLabel: "OCT", role: "oscillator-octave", binding: octave, min: -4, max: 4, initial: 0, step: 1, detentStep: 1, suffix: "oct", modulationParameterKind: null },
        { label: "Oscillator semitone", shortLabel: "SEMI", role: "oscillator-semitone", binding: semitone, min: -12, max: 12, initial: 0, step: 1, detentStep: 1, suffix: "st", modulationParameterKind: "pitchSemitones" },
        { label: "Oscillator fine tune", shortLabel: "FINE", role: "oscillator-fine", binding: fineCents, min: -100, max: 100, initial: 0, step: 0.1, detentStep: null, suffix: "ct", modulationParameterKind: null },
        { label: "Oscillator level", shortLabel: "LEVEL", role: "oscillator-level", binding: volumeDb, min: OSCILLATOR_VOLUME_MIN_DB, max: OSCILLATOR_VOLUME_MAX_DB, initial: OSCILLATOR_DEFAULT_VOLUME_DB, step: 0.1, detentStep: null, suffix: "dB", modulationParameterKind: "ampGainDb" },
    ] as const;

    return (
        <section
            data-role="oscillator-performance-controls"
            data-bounce-inert={inactive ? "true" : undefined}
            aria-disabled={inactive}
            inert={inactive}
            title={inactive ? "Baked into the sampled source. Revert to edit oscillator controls." : undefined}
            className={`flex min-w-0 flex-wrap items-end gap-2 rounded-[12px] border border-white/[0.05] bg-white/[0.018] px-2 py-1.5 transition ${inactive ? "opacity-35 grayscale" : ""}`}
        >
            {fields.map((field) => (
                <BaseParameterKnob
                    key={field.role}
                    ownerAccent={MOBILE_VOICE_OWNER_ACCENT}
                    descriptor={{
                        endpointID: field.binding.endpointID,
                        label: field.label,
                        shortLabel: field.shortLabel,
                        min: field.min,
                        max: field.max,
                        initial: field.initial,
                        step: field.step,
                        scale: "linear",
                    }}
                    binding={field.binding}
                    dataRole={field.role}
                    trackDataRole={`${field.role}-track`}
                    handleDataRole={`${field.role}-handle`}
                    detentStep={field.detentStep}
                    modulationTargetKind={field.modulationParameterKind === null
                        ? undefined
                        : oscillatorModulationTargetKind(oscillatorID, field.modulationParameterKind)}
                    entrySpec={parameterEntrySpecForScalar({
                        min: field.min,
                        max: field.max,
                        step: field.step,
                        unit: field.suffix,
                        digits: field.step >= 1 ? 0 : 1,
                    })}
                    formatValue={(value) => `${value > 0 ? "+" : ""}${Number.isInteger(value) ? value : value.toFixed(1)} ${field.suffix}`}
                />
            ))}
            <button
                type="button"
                aria-label="Mute selected oscillator"
                aria-pressed={mute.value >= 0.5}
                data-role="oscillator-mute"
                data-host-state={mute.isReady ? "ready" : "loading"}
                disabled={inactive || !mute.isReady}
                className={`h-7 rounded-[8px] border px-2 text-[10px] font-bold uppercase tracking-[0.12em] disabled:cursor-wait disabled:opacity-45 ${
                    mute.value >= 0.5
                        ? "border-amber-300/30 bg-amber-300/16 text-amber-100"
                        : "border-white/[0.07] bg-black/25 text-slate-300/70"
                }`}
                onClick={() => mute.commitValue(mute.value >= 0.5 ? 0 : 1)}
            >
                Mute
            </button>
            <button
                type="button"
                aria-label="Solo selected oscillator"
                aria-pressed={solo.value >= 0.5}
                data-role="oscillator-solo"
                data-host-state={solo.isReady ? "ready" : "loading"}
                disabled={inactive || !solo.isReady}
                className={`h-7 rounded-[8px] border px-2 text-[10px] font-bold uppercase tracking-[0.12em] disabled:cursor-wait disabled:opacity-45 ${
                    solo.value >= 0.5
                        ? "border-cyan-300/30 bg-cyan-300/16 text-cyan-100"
                        : "border-white/[0.07] bg-black/25 text-slate-300/70"
                }`}
                onClick={() => solo.commitValue(solo.value >= 0.5 ? 0 : 1)}
            >
                Solo
            </button>
        </section>
    );
}

function KeyboardToolbar({
    oscillatorID,
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
    oscillatorControlsInactive = false,
}: VoiceGlideSectionProps & {
    oscillatorID: OscillatorID;
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
    oscillatorControlsInactive?: boolean;
}) {
    return (
        <div className="grid gap-3 xl:grid-cols-[minmax(260px,0.76fr)_minmax(0,1.24fr)]">
            <VoiceGlideControlSurface
                playModeValue={playMode.value}
                playModeReady={playMode.isReady}
                onPlayModeChange={(nextValue) => playMode.commitValue(nextValue)}
                playModeFocusBindings={playModeFocusBindings}
                className="grid-cols-[minmax(0,1fr)_auto] items-end"
                glideControl={(
                    <NexusNumberField
                        label="Glide"
                        binding={glideTime}
                        entrySpec={parameterEntrySpecForSeconds({
                            minSeconds: GLIDE_TIME_MIN_SECONDS,
                            maxSeconds: GLIDE_TIME_MAX_SECONDS,
                            stepSeconds: GLIDE_TIME_STEP_SECONDS,
                            currentSeconds: glideTime.value,
                        })}
                        onActivate={glideFocusTarget.onActivate}
                        onBeginTextEntry={glideFocusTarget.onBeginTextEntry}
                        onEndTextEntry={glideFocusTarget.onEndTextEntry}
                    />
                )}
            />
            <div
                data-role="bounce-inert-unison-controls"
                data-bounce-inert={oscillatorControlsInactive ? "true" : undefined}
                aria-disabled={oscillatorControlsInactive}
                inert={oscillatorControlsInactive}
                title={oscillatorControlsInactive ? "Unison is baked into the sampled source. Revert to edit it." : undefined}
                className={`relative transition ${oscillatorControlsInactive ? "opacity-35 grayscale" : ""}`}
            >
                <UnisonControlSurface
                    oscillatorID={oscillatorID}
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
        </div>
    );
}

function KeyboardSection({
    oscillatorID,
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
    onIntentionalNote,
    toolbarOverride,
}: VoiceGlideSectionProps & {
    oscillatorID: OscillatorID;
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
    onIntentionalNote?: (status: number, noteNumber: number, velocity: number) => void;
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
                    oscillatorID={oscillatorID}
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
            keyboard={(
                <KeyboardDock
                    rootNote={keyboardRootNote}
                    noteCount={noteCount}
                    keyboardRef={keyboardRef}
                    onIntentionalNote={onIntentionalNote}
                />
            )}
        />
    );
}

function MsegEditorModal({
    isOpen,
    compactShellBack,
    slotIndex,
    slotLabel,
    msegState,
    morphBinding,
    rateBinding,
    surfaceRef,
    selectedPointIndex,
    hoveredSegmentIndex,
    activeSegmentIndex,
    canUndo,
    onClose,
    onUndo,
    onSelectShape,
    onToggleLoop,
    onPointerDown,
    onPointerMove,
    onPointerLeave,
    onPointerUp,
    rateFocusBindings,
    orientation,
    onOrientationChange,
    routes,
    armedSource,
    resolveScrollLockTargets,
    onRequestParameterMenu,
}: MsegEditorModalProps) {
    const [isMorphAdjusting, setIsMorphAdjusting] = useState(false);
    const [modalHudContainer, setModalHudContainer] = useState<Element | null>(null);
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
        const shellBack = compactShellBack
            ? modalRoot.parentElement
                ?.querySelector<HTMLElement>('[data-role="synth-preset-bar-host"] cosimo-preset-bar')
                ?.shadowRoot
                ?.querySelector<HTMLButtonElement>('[data-action="shell-back"]') ?? null
            : null;
        const siblings = Array.from(modalRoot.parentElement?.children ?? []).filter(
            (candidate): candidate is HTMLElement => candidate instanceof HTMLElement
                && candidate !== modalRoot
                // T28 keeps the compact preset/Back row as live global shell
                // above focused editors; universal Back owns dismissal.
                && candidate.getAttribute("data-role") !== "synth-preset-bar-host"
                // The floating Mod bar is the universal play surface (T11);
                // editing a shape while auditioning it is the point, so the
                // modal must never deaden it.
                && candidate.getAttribute("data-role") !== "mobile-global-mod-rail-portal"
                // T60 groups the portal with the bottom tabs so a parked row
                // can consume exactly one dock row. During full-screen editing
                // the tabs are absent, leaving this wrapper as the bar owner.
                && candidate.querySelector('[data-role="mobile-global-mod-rail-portal"]') === null,
        );
        const inertStates = siblings.map((element) => ({ element, inert: element.inert }));
        for (const sibling of siblings) {
            sibling.inert = true;
        }
        (shellBack ?? doneButtonRef.current)?.focus({ preventScroll: true });

        const focusedElement = () => {
            let activeElement: Element | null = document.activeElement;
            while (activeElement instanceof HTMLElement && activeElement.shadowRoot?.activeElement) {
                activeElement = activeElement.shadowRoot.activeElement;
            }
            return activeElement;
        };

        const keepFocusInside = (event: KeyboardEvent) => {
            if (event.key !== "Tab") {
                return;
            }
            const modalFocusable = Array.from(modalRoot.querySelectorAll<HTMLElement>(
                'button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])',
            ));
            const focusable = shellBack === null
                ? modalFocusable
                : [shellBack, ...modalFocusable];
            if (focusable.length === 0) {
                return;
            }
            const currentIndex = focusable.indexOf(focusedElement() as HTMLElement);
            const nextIndex = event.shiftKey
                ? (currentIndex <= 0 ? focusable.length - 1 : currentIndex - 1)
                : (currentIndex >= focusable.length - 1 ? 0 : currentIndex + 1);
            event.preventDefault();
            focusable[nextIndex]?.focus();
        };

        window.addEventListener("keydown", keepFocusInside, true);
        return () => {
            window.removeEventListener("keydown", keepFocusInside, true);
            for (const state of inertStates) {
                state.element.inert = state.inert;
            }
            previouslyFocused?.focus({ preventScroll: true });
        };
    }, [compactShellBack, isOpen]);

    if (!isOpen || !msegState) {
        return null;
    }

    return (
        <div ref={backdropRef} className="synth-modal-backdrop mseg-editor-backdrop fixed inset-0 z-50 flex items-center justify-center">
            <MsegEditorShell
                variant="full"
                label={slotLabel}
                accent={findRackModulationSource("mseg", slotIndex + 1).accent}
                dataRole="mseg-editor-dialog"
                dataSectionAccent="mint"
                role="dialog"
                ariaModal={!compactShellBack}
                ariaLabel={`${slotLabel} editor`}
                headerActions={(
                    <>
                        <button
                            type="button"
                            data-role="mseg-editor-undo"
                            className="mseg-editor-action"
                            disabled={!canUndo}
                            onClick={onUndo}
                        >
                            Undo
                        </button>
                        {!compactShellBack ? (
                            <button
                                ref={doneButtonRef}
                                type="button"
                                data-role="mseg-editor-done"
                                className="cosimo-button mseg-editor-action"
                                onClick={onClose}
                            >
                                Done
                            </button>
                        ) : null}
                    </>
                )}
                controls={(
                    <MsegEditorControlStrip
                        slotIndex={slotIndex}
                        rateBinding={rateBinding}
                        morphBinding={morphBinding}
                        morphShapeAPoints={msegState.shapeA?.points ?? null}
                        morphShapeBPoints={msegState.shapeB?.points ?? null}
                        routes={routes}
                        armedSource={armedSource}
                        hudContainer={modalHudContainer}
                        rolePrefix="mseg-editor"
                        dataRole="mseg-editor-controls"
                        variant="full"
                        editShapeIndex={msegState.editShapeIndex ?? 0}
                        onSelectShape={onSelectShape}
                        resolveScrollLockTargets={resolveScrollLockTargets}
                        onRequestParameterMenu={onRequestParameterMenu}
                        rateFocusBindings={rateFocusBindings}
                        onMorphAdjustingChange={setIsMorphAdjusting}
                        loopEnabled={msegState.playback.loop !== null}
                        onToggleLoop={onToggleLoop}
                    />
                )}
                graphic={(
                    <EditableMsegSurface
                        surfaceRef={surfaceRef}
                        points={msegState.shape.points}
                        referencePoints={msegState.referenceShape?.points ?? null}
                        morphShapeAPoints={msegState.shapeA?.points ?? null}
                        morphShapeBPoints={msegState.shapeB?.points ?? null}
                        morphValue={morphBinding.value}
                        realizedMorphEmphasis={isMorphAdjusting ? "active" : "resting"}
                        editShapeIndex={msegState.editShapeIndex ?? 0}
                        selectedPointIndex={selectedPointIndex}
                        hoveredSegmentIndex={hoveredSegmentIndex}
                        activeSegmentIndex={activeSegmentIndex}
                        orientation={orientation}
                        timeAxisScale={{ kind: "seconds", totalSeconds: msegState.playback.rate.seconds }}
                        onOrientationChange={onOrientationChange}
                        onPointerDown={onPointerDown}
                        onPointerMove={onPointerMove}
                        onPointerLeave={onPointerLeave}
                        onPointerUp={onPointerUp}
                        className="h-full w-full"
                        dataRole="mseg-editor-surface"
                    />
                )}
                graphicDataRole="mseg-editor-graph"
                overlay={(
                    <div
                        ref={setModalHudContainer}
                        data-role="mseg-editor-hud-layer"
                        className="pointer-events-none absolute inset-0 z-40"
                        aria-hidden={false}
                    />
                )}
            />
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
                    <div className="cosimo-section-title">Macro {slotIndex + 1}</div>
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

function EditableMsegSurfaceHost({
    msegState,
    morphValue,
    showMorphCurve,
    editing,
    progressFillEnd,
}: {
    msegState: NonNullable<ModulationMatrixSectionProps["msegState"]>;
    morphValue: number;
    showMorphCurve: boolean;
    editing: NonNullable<ModulationMatrixSectionProps["msegDirectEditing"]>;
    /** Live playback progress (0..1) — the compact editable graph keeps the
        preview's playhead so editability never costs the activity light. */
    progressFillEnd: number;
}) {
    const localRef = useRef<SVGSVGElement | null>(null);
    const attachSurface = useCallback((element: SVGSVGElement | null) => {
        localRef.current = element;
        // Steady-state owner: whichever editable surface mounted last. The
        // pointer-down claim below covers the full editor handing back.
        if (element !== null) {
            editing.sharedSurfaceRef.current = element;
        }
    }, [editing.sharedSurfaceRef]);
    const surfaceRefObject = useMemo(() => ({
        get current() {
            return localRef.current;
        },
        set current(element: SVGSVGElement | null) {
            attachSurface(element);
        },
    }), [attachSurface]);

    return (
        <EditableMsegSurface
            surfaceRef={surfaceRefObject}
            points={msegState.shape.points}
            referencePoints={msegState.referenceShape?.points ?? null}
            morphShapeAPoints={msegState.shapeA?.points ?? null}
            morphShapeBPoints={msegState.shapeB?.points ?? null}
            morphValue={morphValue}
            realizedMorphEmphasis={showMorphCurve ? "active" : "resting"}
            editShapeIndex={msegState.editShapeIndex ?? 0}
            selectedPointIndex={editing.selectedPointIndex}
            hoveredSegmentIndex={editing.hoveredSegmentIndex}
            activeSegmentIndex={editing.activeSegmentIndex}
            onPointerDown={(event) => {
                // Claim the shape-editing brain's geometry ref for THIS
                // surface (the modal releases it by closing).
                editing.sharedSurfaceRef.current = localRef.current;
                editing.onPointerDown(event);
            }}
            onPointerMove={editing.onPointerMove}
            onPointerLeave={editing.onPointerLeave}
            onPointerUp={editing.onPointerUp}
            className="h-full w-full"
            dataRole="mod-source-mseg-surface"
        />
    );
}

function EditableMsegPlayhead({ progressFillEnd }: { progressFillEnd: number }) {
    return (
        <div
            data-role="mod-source-mseg-playhead"
            data-progress={progressFillEnd.toFixed(3)}
            aria-hidden="true"
            className="pointer-events-none absolute inset-y-0 w-px bg-cyan-200/50"
            style={{ left: `${(progressFillEnd * 100).toFixed(2)}%` }}
        />
    );
}

function ModulationMatrixSection({
    compact = false,
    focusedSource = null,
    armedSource = null,
    onArmSource,
    selectedMsegSlot,
    msegState,
    selectedMsegMorph,
    callbackControlReadiness,
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
    msegDirectEditing = null,
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
    const selectedEnvelopeReleaseMinimumSeconds = envelopeReleaseMinimumSeconds(selectedEnvelopeSlot);
    const activeEditorSlotCount = activeEditorTab.kind === "macro"
        ? MODULATION_MACRO_SLOT_COUNT
        : activeEditorTab.kind === "envelope"
            ? ENVELOPE_EDITOR_SLOT_COUNT
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

    // T14: the page and the floating Mod bar share ONE selection. The bar's
    // armed source drives the page's editor here; the page's own selectors
    // push back through onArmSource, so the shape the user sees is always the
    // shape the full editor opens.
    const armedSourceKind = armedSource?.sourceKind ?? null;
    const armedSourceSlot = armedSource?.sourceSlot ?? 0;
    useEffect(() => {
        if (armedSourceKind === null) {
            return;
        }

        const slotIndex = armedSourceSlot - 1;
        if (armedSourceKind === "mseg") {
            onSelectMsegSlot(slotIndex);
            setActiveEditorTab((current) => (
                current.kind === "mseg" && current.slotIndex === slotIndex
                    ? current
                    : { kind: "mseg", slotIndex }
            ));
            return;
        }
        if (armedSourceKind === "env") {
            onSelectEnvelopeSlot(slotIndex);
            setActiveEditorTab((current) => (
                current.kind === "envelope" && current.slotIndex === slotIndex
                    ? current
                    : { kind: "envelope", slotIndex }
            ));
            return;
        }
        setActiveEditorTab((current) => (
            current.kind === "macro" && current.slotIndex === slotIndex
                ? current
                : { kind: "macro", slotIndex }
        ));
    }, [armedSourceKind, armedSourceSlot, onSelectEnvelopeSlot, onSelectMsegSlot]);

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
    const [msegRateEntryError, setMsegRateEntryError] = useState("");
    const msegRateEditingSpecRef = useRef<ParameterEntrySpec | null>(null);
    const skipMsegRateBlurRef = useRef(false);
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

    useEffect(() => {
        if (callbackControlReadiness.mseg.rate) {
            return;
        }
        cancelMsegRateDrag();
        setIsEditingMsegRate(false);
        setMsegRateEntryError("");
    }, [callbackControlReadiness.mseg.rate, cancelMsegRateDrag]);

    const currentMsegRate = clampMsegRateSeconds(Number(msegState?.playback.rate.seconds ?? 1));
    const msegRateEntrySpec = parameterEntrySpecForSeconds({
        minSeconds: MSEG_RATE_MIN_SECONDS,
        maxSeconds: MSEG_RATE_MAX_SECONDS,
        stepSeconds: 0.001,
        currentSeconds: currentMsegRate,
    });

    const beginMsegRateTextEntry = useCallback(() => {
        if (!callbackControlReadiness.mseg.rate) {
            return;
        }
        msegRateEditingSpecRef.current = msegRateEntrySpec;
        setDraftMsegRate(formatParameterEntry(msegRateEntrySpec, currentMsegRate).draft);
        setMsegRateEntryError("");
        setIsEditingMsegRate(true);
    }, [callbackControlReadiness.mseg.rate, currentMsegRate, msegRateEntrySpec]);

    const updateMsegRateDrag = useCallback((event: Pick<PointerEvent, "pointerId" | "pointerType" | "buttons" | "clientX" | "preventDefault">) => {
        const drag = msegRateDragRef.current;
        if (!callbackControlReadiness.mseg.rate || !drag || drag.pointerId !== event.pointerId || isEditingMsegRate) {
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
    }, [callbackControlReadiness.mseg.rate, cancelMsegRateDrag, isEditingMsegRate, onMsegRateChange]);

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
            if (!callbackControlReadiness.mseg.rate || isEditingMsegRate) return;
            event.preventDefault();
            el.style.cursor = "none";
            clearUiTimeout(timerRef.current);
            timerRef.current = uiTimeout(() => { el.style.cursor = ""; }, 400);
            const step = ((MSEG_RATE_MAX_SECONDS - MSEG_RATE_MIN_SECONDS) / 400) * (event.deltaY > 0 ? 1 : -1);
            onMsegRateChange(clamp(currentMsegRate + step, MSEG_RATE_MIN_SECONDS, MSEG_RATE_MAX_SECONDS));
        };
        el.addEventListener("wheel", handler, { passive: false });
        return () => {
            el.removeEventListener("wheel", handler);
            clearUiTimeout(timerRef.current);
            el.style.cursor = "";
        };
    }, [callbackControlReadiness.mseg.rate, isEditingMsegRate, currentMsegRate, onMsegRateChange]);

    const commitMsegRateText = useCallback((text: string) => {
        if (!callbackControlReadiness.mseg.rate) {
            return false;
        }
        const spec = msegRateEditingSpecRef.current ?? msegRateEntrySpec;
        const result = parseParameterEntry(spec, text);
        if (result._tag === "rejected") {
            setMsegRateEntryError(result.message);
            return false;
        }
        if (result.commit._tag !== "value") {
            throw new Error("MSEG rate cannot commit a tempo division.");
        }
        setDraftMsegRate(result.echo.draft);
        setMsegRateEntryError("");
        onMsegRateChange(result.commit.value);
        setIsEditingMsegRate(false);
        return true;
    }, [callbackControlReadiness.mseg.rate, msegRateEntrySpec, onMsegRateChange]);

    // ADSR draft state (for envelope tab top-bar inputs)
    const [draftAttack, setDraftAttack] = useState("");
    const [draftDecay, setDraftDecay] = useState("");
    const [draftSustain, setDraftSustain] = useState("");
    const [draftRelease, setDraftRelease] = useState("");
    const [activeEnvelopeDraftField, setActiveEnvelopeDraftField] = useState<EnvelopeEntryField | null>(null);
    const [envelopeEntryError, setEnvelopeEntryError] = useState<{
        readonly field: EnvelopeEntryField;
        readonly message: string;
    } | null>(null);
    const skipEnvelopeBlurFieldRef = useRef<EnvelopeEntryField | null>(null);
    const envelopeEditingSpecRef = useRef<{
        readonly field: EnvelopeEntryField;
        readonly spec: ParameterEntrySpec;
    } | null>(null);

    const entrySpecForEnvelopeField = useCallback((
        field: EnvelopeEntryField,
        currentValue: number,
    ) => field === "sustain"
        ? ENVELOPE_SUSTAIN_ENTRY_SPEC
        : envelopeTimeEntrySpec(
            currentValue,
            field === "releaseSeconds" ? selectedEnvelopeReleaseMinimumSeconds : ENVELOPE_TIME_MIN_SECONDS,
        ), [selectedEnvelopeReleaseMinimumSeconds]);

    useEffect(() => {
        if (!selectedEnvelope) {
            return;
        }
        if (activeEnvelopeDraftField !== "attackSeconds") {
            setDraftAttack(formatParameterEntry(
                envelopeTimeEntrySpec(selectedEnvelope.attackSeconds),
                selectedEnvelope.attackSeconds,
            ).display);
        }
        if (activeEnvelopeDraftField !== "decaySeconds") {
            setDraftDecay(formatParameterEntry(
                envelopeTimeEntrySpec(selectedEnvelope.decaySeconds),
                selectedEnvelope.decaySeconds,
            ).display);
        }
        if (activeEnvelopeDraftField !== "sustain") {
            setDraftSustain(formatParameterEntry(ENVELOPE_SUSTAIN_ENTRY_SPEC, selectedEnvelope.sustain).display);
        }
        if (activeEnvelopeDraftField !== "releaseSeconds") {
            setDraftRelease(formatParameterEntry(
                entrySpecForEnvelopeField("releaseSeconds", selectedEnvelope.releaseSeconds),
                selectedEnvelope.releaseSeconds,
            ).display);
        }
    }, [
        activeEnvelopeDraftField,
        entrySpecForEnvelopeField,
        selectedEnvelope?.attackSeconds,
        selectedEnvelope?.decaySeconds,
        selectedEnvelope?.releaseSeconds,
        selectedEnvelope?.sustain,
    ]);

    useEffect(() => {
        if (
            activeEnvelopeDraftField === null
            || callbackControlReadiness.envelope[activeEnvelopeDraftField]
        ) {
            return;
        }

        // An endpoint/connection change invalidates the old field's draft.
        // Do not leave it visible and later commit-able once the new endpoint
        // becomes ready.
        skipEnvelopeBlurFieldRef.current = activeEnvelopeDraftField;
        envelopeEditingSpecRef.current = null;
        setEnvelopeEntryError(null);
        setActiveEnvelopeDraftField(null);
    }, [activeEnvelopeDraftField, callbackControlReadiness.envelope]);

    const commitEnvelopeEntryField = useCallback((
        field: EnvelopeEntryField,
        draftValue: string,
        currentValue: number,
        setDraft: (nextValue: string) => void,
    ) => {
        if (!selectedEnvelope || !callbackControlReadiness.envelope[field]) {
            return false;
        }
        const activeSpec = envelopeEditingSpecRef.current;
        const spec = activeSpec?.field === field
            ? activeSpec.spec
            : entrySpecForEnvelopeField(field, currentValue);
        const result = parseParameterEntry(spec, draftValue);
        if (result._tag === "rejected") {
            setEnvelopeEntryError({ field, message: result.message });
            return false;
        }
        if (result.commit._tag !== "value") {
            throw new Error("An envelope field cannot commit a tempo division.");
        }
        setEnvelopeEntryError(null);
        setDraft(result.echo.display);
        envelopeEditingSpecRef.current = null;
        onEnvelopeChange(field, result.commit.value);
        return true;
    }, [callbackControlReadiness.envelope, entrySpecForEnvelopeField, onEnvelopeChange, selectedEnvelope]);

    const handleEnvelopeFieldKeyDown = useCallback((
        event: ReactKeyboardEvent<HTMLInputElement>,
        field: EnvelopeEntryField,
        draftValue: string,
        currentValue: number,
        setDraft: (nextValue: string) => void,
    ) => {
        if (!selectedEnvelope || !callbackControlReadiness.envelope[field]) {
            return;
        }
        if (event.key === "Enter") {
            event.preventDefault();
            if (commitEnvelopeEntryField(field, draftValue, currentValue, setDraft)) {
                skipEnvelopeBlurFieldRef.current = field;
                setActiveEnvelopeDraftField(null);
                event.currentTarget.blur();
            }
            return;
        }
        if (event.key === "Escape") {
            event.preventDefault();
            const activeSpec = envelopeEditingSpecRef.current;
            const spec = activeSpec?.field === field
                ? activeSpec.spec
                : entrySpecForEnvelopeField(field, currentValue);
            setDraft(formatParameterEntry(spec, currentValue).display);
            setEnvelopeEntryError(null);
            envelopeEditingSpecRef.current = null;
            skipEnvelopeBlurFieldRef.current = field;
            setActiveEnvelopeDraftField(null);
            event.currentTarget.blur();
        }
    }, [callbackControlReadiness.envelope, commitEnvelopeEntryField, selectedEnvelope]);

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
                                        onArmSource?.({ sourceKind: "mseg", sourceSlot: 1 });
                                    } else if (nextKind === "envelope") {
                                        onSelectEnvelopeSlot(0);
                                        setActiveEditorTab({ kind: "envelope", slotIndex: 0 });
                                        onArmSource?.({ sourceKind: "env", sourceSlot: 1 });
                                    } else if (nextKind === "macro") {
                                        setActiveEditorTab({ kind: "macro", slotIndex: 0 });
                                        onArmSource?.({ sourceKind: "macro", sourceSlot: 1 });
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
                                    const nextSlotNumber = nextSlotIndex + 1;
                                    const maximumArmableSlot = activeEditorTab.kind === "envelope"
                                        ? ENVELOPE_EDITOR_SLOT_COUNT
                                        : MODULATION_ENV_SLOT_COUNT;
                                    if (nextSlotNumber >= 1 && nextSlotNumber <= maximumArmableSlot) {
                                        onArmSource?.({
                                            sourceKind: activeEditorTab.kind === "envelope" ? "env" : activeEditorTab.kind,
                                            sourceSlot: nextSlotNumber as 1 | 2 | 3 | 4,
                                        });
                                    }
                                }}
                            >
                                {Array.from({ length: activeEditorSlotCount }, (_, slotIndex) => (
                                    <option key={`mobile-mod-source-slot-${slotIndex}`} value={slotIndex + 1}>
                                        {activeEditorTab.kind === "envelope" && slotIndex === AMP_ENVELOPE_EDITOR_SLOT_INDEX
                                            ? "Amp"
                                            : slotIndex + 1}
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
                    <span className="cosimo-section-title ml-0.5">Mseg</span>
                </div>

                {/* Separator */}
                <div className="mod-source-separator mx-0.5 h-3 w-px shrink-0 bg-white/[0.06]" />

                {/* ENV pips */}
                <div data-role="mobile-mod-source-family" data-source-family="env" className="mod-source-family flex items-center gap-1">
                    <div className="flex gap-[3px]">
                        {Array.from({ length: ENVELOPE_EDITOR_SLOT_COUNT }, (_, slotIndex) => (
                            <button
                                key={`env-pip-${slotIndex}`}
                                type="button"
                                aria-label={slotIndex === AMP_ENVELOPE_EDITOR_SLOT_INDEX
                                    ? "Select Amp Envelope"
                                    : `Select envelope ${slotIndex + 1}`}
                                className={`grid ${slotIndex === AMP_ENVELOPE_EDITOR_SLOT_INDEX ? "h-[18px] w-[30px] max-[480px]:h-7 max-[480px]:w-10" : "size-[18px] max-[480px]:size-7"} place-items-center rounded-[5px] border p-0 text-[8px] leading-none font-bold transition max-[480px]:rounded-[6px] max-[480px]:text-[10px] ${
                                    activeEditorTab.kind === "envelope" && activeEnvelopeSlot === slotIndex
                                        ? "synth-accent-active-button"
                                        : "border-white/[0.06] bg-white/[0.02] text-slate-300/40 hover:border-white/10 hover:text-slate-300/65"
                                }`}
                                onClick={() => {
                                    onSelectEnvelopeSlot(slotIndex);
                                    setActiveEditorTab({ kind: "envelope", slotIndex });
                                }}
                            >
                                {slotIndex === AMP_ENVELOPE_EDITOR_SLOT_INDEX ? "AMP" : slotIndex + 1}
                            </button>
                        ))}
                    </div>
                    <span className="cosimo-section-title ml-0.5">Env</span>
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
                    <span className="cosimo-section-title ml-0.5">Macro</span>
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
                        <span className="relative flex items-center">
                        <input
                            ref={msegRateRef}
                            type="text"
                            inputMode="decimal"
                            autoComplete="off"
                            spellCheck={false}
                            readOnly={!isEditingMsegRate}
                            aria-label="MSEG rate"
                            data-host-state={callbackControlReadiness.mseg.rate ? "ready" : "loading"}
                            data-modulation-target-kind={`mseg${selectedMsegSlot + 1}Rate`}
                            className={`cosimo-readout is-caps w-[64px] touch-none select-none whitespace-nowrap rounded border border-white/[0.04] bg-white/[0.03] px-1.5 py-[3px] text-left leading-none outline-none disabled:cursor-wait disabled:opacity-45 max-[480px]:w-[68px] max-[480px]:px-2 max-[480px]:py-1 ${
                                isEditingMsegRate
                                    ? "cursor-text"
                                    : "cursor-ew-resize"
                            }`}
                            value={isEditingMsegRate
                                ? draftMsegRate
                                : formatParameterEntry(msegRateEntrySpec, currentMsegRate).display}
                            disabled={!callbackControlReadiness.mseg.rate}
                            tabIndex={activeEditorTab.kind === "mseg" ? 0 : -1}
                            onPointerDown={(event) => {
                                if (!callbackControlReadiness.mseg.rate || event.button !== 0 || isEditingMsegRate) return;
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
                                    beginMsegRateTextEntry();
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
                                }
                            }}
                            onKeyDown={(event) => {
                                if (!isEditingMsegRate) {
                                    if (event.key === "Enter") { event.preventDefault(); beginMsegRateTextEntry(); }
                                    return;
                                }
                                if (event.key === "Enter") {
                                    event.preventDefault();
                                    if (commitMsegRateText(draftMsegRate)) {
                                        skipMsegRateBlurRef.current = true;
                                        msegRateRef.current?.blur();
                                    }
                                }
                                if (event.key === "Escape") {
                                    event.preventDefault();
                                    setMsegRateEntryError("");
                                    setIsEditingMsegRate(false);
                                    skipMsegRateBlurRef.current = true;
                                    msegRateRef.current?.blur();
                                }
                            }}
                            onBlur={() => {
                                if (skipMsegRateBlurRef.current) {
                                    skipMsegRateBlurRef.current = false;
                                } else if (isEditingMsegRate && !commitMsegRateText(draftMsegRate)) {
                                    requestAnimationFrame(() => msegRateRef.current?.focus());
                                }
                            }}
                            {...msegRateFocusBindings}
                        />
                        {isEditingMsegRate ? (
                            <span
                                data-role="parameter-entry-unit"
                                className="cosimo-readout is-caps is-caption pointer-events-none absolute right-1.5 opacity-60"
                            >
                                {formatParameterEntry(msegRateEditingSpecRef.current ?? msegRateEntrySpec, currentMsegRate).unit}
                            </span>
                        ) : null}
                        {msegRateEntryError ? (
                            <span
                                role="alert"
                                data-role="parameter-entry-error"
                                className="absolute right-0 top-full z-30 mt-1 min-w-40 rounded bg-red-950/95 px-1.5 py-1 text-[9px] text-red-100 shadow-lg"
                            >
                                {msegRateEntryError}
                            </span>
                        ) : null}
                        </span>
                    </div>

                    {/* Envelope ADSR controls */}
                    <div className={`absolute inset-0 flex items-center justify-end gap-1.5 ${activeEditorTab.kind === "envelope" && selectedEnvelope ? "visible" : "invisible"}`}>
                        {selectedEnvelope ? ([
                            envelopeEntryParameter({ label: "A", compactLabel: "Attack", ariaLabel: "Envelope attack value", field: "attackSeconds", target: "Attack", draft: draftAttack, setDraft: setDraftAttack, current: selectedEnvelope.attackSeconds }),
                            envelopeEntryParameter({ label: "D", compactLabel: "Decay", ariaLabel: "Envelope decay value", field: "decaySeconds", target: "Decay", draft: draftDecay, setDraft: setDraftDecay, current: selectedEnvelope.decaySeconds }),
                            envelopeEntryParameter({ label: "S", compactLabel: "Sustain", ariaLabel: "Envelope sustain value", field: "sustain", target: "Sustain", draft: draftSustain, setDraft: setDraftSustain, current: selectedEnvelope.sustain }),
                            envelopeEntryParameter({ label: "R", compactLabel: "Release", ariaLabel: "Envelope release value", field: "releaseSeconds", target: "Release", draft: draftRelease, setDraft: setDraftRelease, current: selectedEnvelope.releaseSeconds }),
                        ]).map((param) => (
                            <label
                                key={param.label}
                                className="flex items-center gap-[3px]"
                                data-host-state={callbackControlReadiness.envelope[param.field] ? "ready" : "loading"}
                                aria-busy={!callbackControlReadiness.envelope[param.field]}
                            >
                                <span className="text-[9px] font-semibold uppercase text-slate-400/60">
                                    {compact ? param.compactLabel : param.label}
                                </span>
                                <div className="relative flex items-center">
                                <input
                                    aria-label={param.ariaLabel}
                                    data-modulation-target-kind={selectedEnvelopeSlot === AMP_ENVELOPE_EDITOR_SLOT_INDEX
                                        ? `amp${param.target}`
                                        : `env${selectedEnvelopeSlot + 1}${param.target}`}
                                    type="text"
                                    inputMode="decimal"
                                    disabled={!callbackControlReadiness.envelope[param.field]}
                                    data-host-state={callbackControlReadiness.envelope[param.field] ? "ready" : "loading"}
                                    className="cosimo-readout is-caps is-caption w-[52px] rounded border border-white/[0.06] bg-white/[0.03] py-[2px] pl-1 pr-5 text-left leading-none outline-none focus:border-[var(--section-accent)] disabled:cursor-wait disabled:opacity-45 max-[480px]:w-[56px]"
                                    value={param.draft}
                                    onFocus={(event) => {
                                        const spec = entrySpecForEnvelopeField(param.field, param.current);
                                        const editingDraft = formatParameterEntry(spec, param.current).draft;
                                        envelopeEditingSpecRef.current = { field: param.field, spec };
                                        event.currentTarget.value = editingDraft;
                                        param.setDraft(editingDraft);
                                        setEnvelopeEntryError(null);
                                        setActiveEnvelopeDraftField(param.field);
                                    }}
                                    onChange={(e) => param.setDraft(e.target.value)}
                                    onBlur={(event) => {
                                        if (skipEnvelopeBlurFieldRef.current === param.field) {
                                            skipEnvelopeBlurFieldRef.current = null;
                                            return;
                                        }
                                        if (!callbackControlReadiness.envelope[param.field]) {
                                            envelopeEditingSpecRef.current = null;
                                            setEnvelopeEntryError(null);
                                            setActiveEnvelopeDraftField(null);
                                            return;
                                        }
                                        if (commitEnvelopeEntryField(param.field, param.draft, param.current, param.setDraft)) {
                                            setActiveEnvelopeDraftField(null);
                                        } else {
                                            const input = event.currentTarget;
                                            requestAnimationFrame(() => input.focus());
                                        }
                                    }}
                                    onKeyDown={(e) => {
                                        handleEnvelopeFieldKeyDown(
                                            e,
                                            param.field,
                                            param.draft,
                                            param.current,
                                            param.setDraft,
                                        );
                                    }}
                                    tabIndex={activeEditorTab.kind === "envelope" ? 0 : -1}
                                />
                                {activeEnvelopeDraftField === param.field ? (
                                    <span
                                        data-role="parameter-entry-unit"
                                        className="cosimo-readout is-caps is-caption pointer-events-none absolute right-1 opacity-60"
                                    >
                                        {formatParameterEntry(
                                            envelopeEditingSpecRef.current?.field === param.field
                                                ? envelopeEditingSpecRef.current.spec
                                                : entrySpecForEnvelopeField(param.field, param.current),
                                            param.current,
                                        ).unit}
                                    </span>
                                ) : null}
                                {envelopeEntryError?.field === param.field ? (
                                    <span
                                        role="alert"
                                        data-role="parameter-entry-error"
                                        className="absolute right-0 top-full z-30 mt-1 min-w-36 rounded bg-red-950/95 px-1.5 py-1 text-[9px] text-red-100 shadow-lg"
                                    >
                                        {envelopeEntryError.message}
                                    </span>
                                ) : null}
                                </div>
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
                    <span className="cosimo-section-title mr-1">Fixed</span>
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
                {activeEditorTab.kind === "mseg" && compact && msegDirectEditing !== null ? (
                    <div className="relative h-full w-full">
                        <div className="absolute inset-x-0 top-0 bottom-[48px]" data-role="mod-source-mseg-editable">
                            {msegState ? (
                                <>
                                    <EditableMsegSurfaceHost
                                        msegState={msegState}
                                        morphValue={selectedMsegMorph.value}
                                        showMorphCurve={isMsegMorphAdjusting}
                                        editing={msegDirectEditing}
                                        progressFillEnd={observedMsegPlayhead.progressFillEnd ?? 0}
                                    />
                                    {observedMsegPlayhead.progressFillEnd !== null ? (
                                        <EditableMsegPlayhead progressFillEnd={observedMsegPlayhead.progressFillEnd} />
                                    ) : null}
                                </>
                            ) : (
                                <div className="h-full w-full bg-white/[0.02]" />
                            )}
                        </div>
                        <div className="absolute inset-x-3 bottom-2 flex items-center gap-2">
                            <div className="min-w-0 flex-1">
                                <MsegMorphRail
                                    binding={selectedMsegMorph}
                                    modulationTargetKind={`mseg${selectedMsegSlot + 1}Morph` as ModulationTargetKind}
                                    onChange={onMsegMorphChange}
                                    onAdjustingChange={setIsMsegMorphAdjusting}
                                />
                            </div>
                            {/* Outside the graph: a fixed corner chip collides
                                with real point positions (the default shape's
                                end point lives at the top right). */}
                            <button
                                type="button"
                                data-role="mod-source-mseg-expand"
                                className="cosimo-readout is-caps shrink-0 rounded-[6px] border border-white/[0.12] bg-[rgba(3,5,12,0.6)] px-2 py-1"
                                onClick={onOpenMsegEditor}
                                aria-label="Open MSEG editor"
                            >
                                ⤢
                            </button>
                        </div>
                    </div>
                ) : activeEditorTab.kind === "mseg" ? (
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
                                    editShapeIndex={msegState.editShapeIndex ?? 0}
                                    className="h-full w-full"
                                    progressFillEnd={observedMsegPlayhead.progressFillEnd}
                                />
                            ) : (
                                <div className="h-full w-full bg-white/[0.02]" />
                            )}
                            <div className="pointer-events-none absolute inset-0 grid place-items-center opacity-0 transition-opacity group-hover:opacity-100">
                                <span className="cosimo-readout is-caps rounded-[6px] bg-[rgba(3,5,12,0.6)] px-2.5 py-1 opacity-45">
                                    Edit Shape
                                </span>
                            </div>
                        </button>
                        <div className="absolute inset-x-3 bottom-2">
                            <MsegMorphRail
                                binding={selectedMsegMorph}
                                modulationTargetKind={`mseg${selectedMsegSlot + 1}Morph` as ModulationTargetKind}
                                onChange={onMsegMorphChange}
                                onAdjustingChange={setIsMsegMorphAdjusting}
                            />
                        </div>
                    </div>
                ) : activeEditorTab.kind === "envelope" && selectedEnvelope ? (
                    <DesktopEnvelopeEditor
                        selectedEnvelope={selectedEnvelope}
                        onEnvelopeChange={onEnvelopeChange}
                        readiness={callbackControlReadiness.envelope}
                        releaseMinimumSeconds={selectedEnvelopeReleaseMinimumSeconds}
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

type MobileModSource = Pick<RackModulationSource, "sourceKind" | "sourceSlot">;

type MobileWorkspaceSection = WorkspaceTabId;

function parseMobileModSourceDetail(detail: string | null): MobileModSource | null {
    if (detail === null) {
        return null;
    }
    const [kind, slotText] = detail.split(":");
    const slot = Number(slotText);
    if (
        (kind === "mseg" && (slot === 1 || slot === 2 || slot === 3))
        || (kind === "env" && (slot === 1 || slot === 2 || slot === 3 || slot === 4))
        || (kind === "macro" && (slot === 1 || slot === 2 || slot === 3))
    ) {
        return { sourceKind: kind, sourceSlot: slot };
    }
    return null;
}

function DesktopPatchViewBody({
    keyboardInputMode,
}: {
    keyboardInputMode: SynthKeyboardInputMode;
}) {
    const stageRef = useRef<HTMLDivElement | null>(null);
    const scrollRegionRef = useRef<HTMLElement | null>(null);
    const msegEditorSurfaceRef = useRef<SVGSVGElement | null>(null);
    const [msegSurfaceOrientation, setMsegSurfaceOrientation] = useState<MsegSurfaceOrientation>("horizontal");
    const keyboardElementRef = useRef<PianoKeyboardElement | null>(null);
    const [isCompactViewport, setIsCompactViewport] = useState(() => (
        typeof window.matchMedia === "function" && window.matchMedia("(max-width: 639px)").matches
    ));
    const modBarPreferences = useSyncExternalStore(
        subscribeModBarPreferences,
        getModBarPreferences,
    );
    const [workspaceShell, setWorkspaceShell] = useState<WorkspaceShellState>(() => {
        try {
            return parseStoredShellState(sessionStorage.getItem(WORKSPACE_SHELL_STORAGE_KEY))
                ?? createHomeShellState();
        } catch {
            return createHomeShellState();
        }
    });
    useEffect(() => {
        // Plugin-instance presentation state (ADR-026): never preset or DAW
        // sound state. sessionStorage scopes it to the live app/editor session
        // so a fresh process starts at Home.
        try {
            sessionStorage.setItem(WORKSPACE_SHELL_STORAGE_KEY, serializeShellState(workspaceShell));
        } catch {
            // Presentation persistence is best effort; navigation keeps working.
        }
    }, [workspaceShell]);
    const mobileWorkspaceSection = workspaceShell.activeTab;
    const mobileModSource = useMemo(
        () => parseMobileModSourceDetail(workspaceShell.details.mod?.detail ?? null),
        [workspaceShell.details.mod],
    );
    const mobileReturnTarget = universalBackTarget(workspaceShell);
    const workspacePanelsRef = useRef(new Map<WorkspaceTabId, HTMLElement>());
    const workspacePanelScrollsRef = useRef(new Map<WorkspaceTabId, number>());
    const mobileBottomDockRef = useRef<HTMLDivElement | null>(null);
    const [mobileModRailPortalTarget, setMobileModRailPortalTarget] = useState<HTMLElement | null>(null);
    const [mobileVoiceHudLayer, setMobileVoiceHudLayer] = useState<HTMLDivElement | null>(null);
    const [globalModRailState, setGlobalModRailState] = useState<GlobalModRailState>({
        expanded: false,
        selectedSource: { sourceKind: "mseg", sourceSlot: 1 },
    });
    const [globalModDragSource, setGlobalModDragSource] = useState<GlobalModRailState["selectedSource"] | null>(null);
    const [openMsegEditorTargetSlot, setOpenMsegEditorTargetSlot] = useState<number | null>(null);
    const activeMsegRouteSource = globalModDragSource ?? globalModRailState.selectedSource;
    const activeMsegRouteSourceIdentity = useMemo(() => {
        const source = findRackModulationSource(
            activeMsegRouteSource.sourceKind,
            activeMsegRouteSource.sourceSlot,
        );
        return {
            sourceKind: source.sourceKind,
            sourceSlot: source.sourceSlot,
            shortLabel: source.shortLabel,
            accent: source.accent,
        };
    }, [activeMsegRouteSource.sourceKind, activeMsegRouteSource.sourceSlot]);
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
            setWorkspaceShell(createHomeShellState());
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
    const [keyboardVisible, setKeyboardVisible] = useState(true);
    const handleToggleKeyboard = useCallback(() => {
        // Hiding the keyboard must never strand its held notes.
        keyboardElementRef.current?.allNotesOff?.();
        setKeyboardVisible((visible) => !visible);
    }, []);
    const [autoPreviewEnabled, setAutoPreviewEnabled] = useState(() => {
        try {
            return parseStoredAutoPreviewEnabled(
                localStorage.getItem(AUTO_PREVIEW_ENABLED_STORAGE_KEY),
            ) ?? false;
        } catch {
            return false;
        }
    });
    const handleToggleAutoPreview = useCallback(() => {
        setAutoPreviewEnabled((enabled) => !enabled);
    }, []);
    useEffect(() => {
        try {
            localStorage.setItem(
                AUTO_PREVIEW_ENABLED_STORAGE_KEY,
                serializeAutoPreviewEnabled(autoPreviewEnabled),
            );
        } catch {
            // A private-browsing storage failure must not break the toggle.
        }
    }, [autoPreviewEnabled]);
    // Developer builds only (perf-tuning.ts): the shell menu's Developer
    // settings page; ordinary production never reveals the row or loads it.
    const [perfTuningOpen, setPerfTuningOpen] = useState(false);
    const openPerfTuning = useCallback(() => setPerfTuningOpen(true), []);
    const closePerfTuning = useCallback(() => setPerfTuningOpen(false), []);
    const curveLab = useDesktopCurveLab();
    const oscillatorSelection = useOscillatorSelectionViewModel();
    const bounceController = useBounceInPlace();
    const [videoBounceRequest, setVideoBounceRequest] = useState<{
        readonly patchInput: unknown;
    } | null>(null);
    const handleBounceVideo = useCallback((patchInput: unknown) => {
        setVideoBounceRequest({ patchInput });
    }, []);
    const synthView = useSynthPatchViewModel({
        oscillatorID: oscillatorSelection.selectedOscillatorID,
        stageRef,
        msegEditorSurfaceRef,
        msegSurfaceOrientation,
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
        autoPreviewEnabled,
        oscillatorTargetsActive: !bounceController.state.sampled,
    });
    const bounceGuardRef = useRef<((continuation: () => void) => void) | null>(null);
    const handleBounceGuardReady = useCallback((
        guard: ((continuation: () => void) => void) | null,
    ) => {
        bounceGuardRef.current = guard;
    }, []);
    const requestBounceGuard = useCallback((continuation: () => void) => {
        const guard = bounceGuardRef.current;
        if (guard) {
            guard(continuation);
        } else {
            continuation();
        }
    }, []);
    const modRailAudition = useMemo<ModRailAuditionBindings>(() => ({
        onNoteKeyDown: synthView.handleStartNoteKeyAudition,
        onNoteKeyUp: synthView.handleStopNoteKeyAudition,
        autoPreviewEnabled,
        onToggleAutoPreview: handleToggleAutoPreview,
        keyboardVisible,
        onToggleKeyboard: handleToggleKeyboard,
    }), [
        autoPreviewEnabled,
        handleToggleAutoPreview,
        handleToggleKeyboard,
        keyboardVisible,
        synthView.handleStartNoteKeyAudition,
        synthView.handleStopNoteKeyAudition,
    ]);
    const modRailVoiceSettings = useMemo<ModRailVoiceSettings>(() => ({
        playMode: synthView.playMode,
        glideTime: synthView.glideTime,
        globalTuneControl: (
            <GlobalTuneKnob
                binding={synthView.globalTune}
                routes={synthView.routes}
                armedSource={globalModRailState.selectedSource}
            />
        ),
    }), [
        globalModRailState.selectedSource,
        synthView.glideTime,
        synthView.globalTune,
        synthView.playMode,
        synthView.routes,
    ]);
    useEffect(() => {
        postNativeKeyboardProbeStatus(`cosimo-keyboard-router-ready:${keyboardInputMode}`);
    }, [keyboardInputMode]);
    const [keyboardControlMode, setKeyboardControlMode] = useState<"articulation" | "voice">("articulation");
    const [isArticulationEditorExpanded, setIsArticulationEditorExpanded] = useState(false);
    const [dismissedContextualToolbarKey, setDismissedContextualToolbarKey] = useState<string | null>(null);
    // T14: the Mod page and the floating bar share ONE selection. The page's
    // selectors arm the bar through this signal (the rail workspace owns the
    // real selection state and re-reports it); the bar's own changes reach
    // the page through the mirrored globalModRailState.selectedSource. The
    // Mod page's armed-source effect owns keeping the hook's MSEG slot in
    // step, so the editor always opens exactly the shape the page shows.
    const [armModSourceSignal, setArmModSourceSignal] = useState<{
        source: GlobalModRailState["selectedSource"];
        serial: number;
    } | null>(null);
    const handleArmModSource = useCallback((source: GlobalModRailState["selectedSource"]) => {
        setOpenMsegEditorTargetSlot(null);
        setGlobalModRailState((current) => ({ ...current, selectedSource: source }));
        setArmModSourceSignal((previous) => ({ source, serial: (previous?.serial ?? 0) + 1 }));
    }, []);
    // T14: choosing a source from the floating bar while inside Mod surfaces
    // the SOURCE panel (never the quick sheet over the full panel).
    const [modPagerFocusSerial, setModPagerFocusSerial] = useState(0);
    const modPagerSourceKey = `${globalModRailState.selectedSource.sourceKind}-${globalModRailState.selectedSource.sourceSlot}`;
    const modPagerSectionRef = useRef(mobileWorkspaceSection);
    modPagerSectionRef.current = mobileWorkspaceSection;
    const modPagerFocusMountedRef = useRef(false);
    useEffect(() => {
        if (!modPagerFocusMountedRef.current) {
            // The mount run is not a selection CHANGE — bumping here would
            // clobber the instance's restored MAPPINGS panel on relaunch.
            modPagerFocusMountedRef.current = true;
            return;
        }
        if (modPagerSectionRef.current === "mod") {
            setModPagerFocusSerial((serial) => serial + 1);
        }
    }, [modPagerSourceKey]);

    // ADR-025 row 15: the just-confirmed route's matrix row pulses briefly.
    const [recentConfirmedRouteId, setRecentConfirmedRouteId] = useState<string | null>(null);
    const handleRouteCreationConfirmed = useCallback((routeId: string) => {
        setRecentConfirmedRouteId(routeId);
    }, []);
    useEffect(() => {
        if (recentConfirmedRouteId === null) {
            return;
        }
        const timeout = uiTimeout(() => setRecentConfirmedRouteId(null), 1100);
        return () => clearUiTimeout(timeout);
    }, [recentConfirmedRouteId]);
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
            oscillatorID={oscillatorSelection.selectedOscillatorID}
            warpMode={synthView.warpMode}
            warpAmount={synthView.warpAmount}
        />
    ), [oscillatorSelection.selectedOscillatorID, synthView.warpAmount, synthView.warpMode]);

    const panField = useMemo(() => (
        <PrecisionNumberField
            ariaLabel="Pan"
            binding={synthView.pan}
            entrySpec={PAN_ENTRY_SPEC}
            suffix={PAN_ENTRY_SPEC.defaultUnit}
            pixelsPerFullRange={180}
            enableWheel
            wheelStep={0.01}
            leadingLabel="Pan"
            dataRole="wavetable-pan-field"
            modulationTargetKind={oscillatorModulationTargetKind(
                oscillatorSelection.selectedOscillatorID,
                "pan",
            )}
            variant="inlineDark"
            width={44}
            height={20}
        />
    ), [oscillatorSelection.selectedOscillatorID, synthView.pan]);
    const selectedOscillatorToolbar = useMemo(() => (
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

            {isCompactViewport ? null : (
                <OscillatorPerformanceControls
                    oscillatorID={oscillatorSelection.selectedOscillatorID}
                    octave={synthView.oscillatorOctave}
                    semitone={synthView.oscillatorSemitone}
                    fineCents={synthView.oscillatorFineCents}
                    volumeDb={synthView.oscillatorVolumeDb}
                    mute={synthView.oscillatorMute}
                    solo={synthView.oscillatorSolo}
                    inactive={bounceController.state.sampled}
                />
            )}

            {keyboardControlMode === "articulation" ? (
                <div className="grid gap-2">
                {bounceController.state.sampled ? (
                    <div
                        data-role="bounce-inert-articulation-notice"
                        className="rounded-[9px] border border-cyan-200/10 bg-cyan-300/5 px-2.5 py-1.5 text-[9px] text-cyan-100/55"
                    >
                        Oscillator overrides are baked. Filter, MSEG and ENV articulation settings remain live.
                    </div>
                ) : null}
                <ArticulationControlSurface
                    cards={articulationCards}
                    activeMode={articulationMode}
                    isExpanded={isArticulationEditorExpanded}
                    selectedArticulationId={selectedArticulationId}
                    selectedIsDirty={synthView.selectedArticulationIsDirty}
                    discardedEditLabel={synthView.discardedArticulationEdit?.slotName ?? null}
                    isBaseReady={synthView.isArticulationBaseReady}
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
                </div>
            ) : (
                <KeyboardToolbar
                    oscillatorID={oscillatorSelection.selectedOscillatorID}
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
                    oscillatorControlsInactive={bounceController.state.sampled}
                />
            )}

        </div>
    ), [
        articulationCards,
        articulationMode,
        bounceController.state.sampled,
        chainSegments,
        handleRenameArticulation,
        handleSelectRangeSegment,
        isArticulationEditorExpanded,
        isCompactViewport,
        keySegments,
        keyboardControlMode,
        keyboardRootNote,
        oscillatorSelection.selectedOscillatorID,
        selectedArticulationId,
        synthView,
        velocitySegments,
    ]);
    const keyboardToolbarOverride = (
        <DesktopOscillatorConnectionBoundary
            content={selectedOscillatorToolbar}
            selectedOscillator={oscillatorSelection.selectedOscillator}
        />
    );

    const workspacePanelElement = useCallback((tab: WorkspaceTabId) => (
        workspacePanelsRef.current.get(tab) ?? null
    ), []);

    const activateWorkspaceTab = useCallback((tab: WorkspaceTabId) => {
        setWorkspaceShell((current) => {
            if (current.activeTab !== tab) {
                const activePanel = workspacePanelElement(current.activeTab);
                if (activePanel) {
                    workspacePanelScrollsRef.current.set(current.activeTab, activePanel.scrollTop);
                }
            }
            return activateTab(current, tab);
        });
    }, [workspacePanelElement]);

    // T06: dwell navigation during a source drag. The drag gesture keeps its
    // owner; these only change what is presented under the held source.
    const handleDragDwellNavigate = useCallback((dwellKey: string) => {
        if (dwellKey.startsWith("workspace-tab:")) {
            const tab = dwellKey.slice("workspace-tab:".length);
            if (!(WORKSPACE_TAB_IDS as ReadonlyArray<string>).includes(tab)) {
                throw new Error(`Unknown dwell tab: ${dwellKey}`);
            }
            activateWorkspaceTab(tab as WorkspaceTabId);
            return;
        }
        if (dwellKey.startsWith("oscillator-tab:")) {
            const oscillatorID = dwellKey.slice("oscillator-tab:".length);
            if (!(OSCILLATOR_IDS as ReadonlyArray<string>).includes(oscillatorID)) {
                throw new Error(`Unknown dwell oscillator: ${dwellKey}`);
            }
            oscillatorSelection.selectOscillator(oscillatorID as OscillatorID);
            return;
        }
        throw new Error(`Unknown dwell action: ${dwellKey}`);
    }, [activateWorkspaceTab, oscillatorSelection]);

    const tapActiveWorkspaceTab = useCallback(() => {
        setWorkspaceShell((current) => {
            const result = tapActiveTab(current);
            if (result.effect === "scroll-to-top") {
                workspacePanelElement(current.activeTab)?.scrollTo({ top: 0, behavior: "smooth" });
            }
            return result.state;
        });
    }, [workspacePanelElement]);

    useLayoutEffect(() => {
        if (!isCompactViewport) {
            return;
        }
        // A panel hidden with display:none loses its DOM scroll position;
        // the shell restores the workspace's own stored offset on activation.
        const panel = workspacePanelElement(workspaceShell.activeTab);
        const storedTop = workspacePanelScrollsRef.current.get(workspaceShell.activeTab);
        if (panel && storedTop !== undefined) {
            panel.scrollTop = storedTop;
        }
    }, [isCompactViewport, workspacePanelElement, workspaceShell.activeTab]);

    const openMobileModSourceDetail = useCallback((source: MobileModSource) => {
        setWorkspaceShell((current) => openDeepLink(current, {
            tab: "mod",
            detail: `${source.sourceKind}:${source.sourceSlot}`,
            from: current.activeTab,
        }));
    }, []);

    // T43: the source and open state are one value. Replacing this value keeps
    // the mounted sheet alive while changing A -> B, so its heading and cells
    // can never observe different source snapshots.
    const [quickEditorSource, setQuickEditorSource] = useState<MobileModSource | null>(null);
    const [isQuickMsegMorphAdjusting, setIsQuickMsegMorphAdjusting] = useState(false);
    const handleQuickMsegDrawerHeightChange = useCallback((height: number | null) => {
        const dock = mobileBottomDockRef.current;
        if (dock === null) {
            return;
        }
        if (height === null) {
            dock.style.removeProperty("--mobile-mseg-drawer-height");
            return;
        }
        // The drawer reports during layout. Keep this one adjacent-layout
        // value synchronous so the parked portal follows CSS detent animation
        // before paint without rerendering the complete synth every frame.
        dock.style.setProperty("--mobile-mseg-drawer-height", `${height}px`);
    }, []);

    useEffect(() => {
        if (quickEditorSource?.sourceKind !== "mseg") {
            setIsQuickMsegMorphAdjusting(false);
        }
    }, [quickEditorSource]);

    /* T20 — the ADR-017 long-press parameter menu: one shared shell state
       machine (also used by the iOS shell). */
    const { openParameterMenu: openShellParameterMenu, parameterMenuOverlays } = useParameterMenuShell({
        routes: synthView.routes,
        armedSourceKind: globalModRailState.selectedSource.sourceKind,
        armedSourceSlot: globalModRailState.selectedSource.sourceSlot,
        onRouteChange: synthView.handleRouteChange,
        onRemoveRoute: synthView.handleRemoveRoute,
    });
    const handleMobileModSourceTap = useCallback((source: MobileModSource) => {
        setOpenMsegEditorTargetSlot(null);
        if (mobileWorkspaceSection === "mod") {
            setWorkspaceShell((current) => (
                openDeepLink(current, {
                    tab: "mod",
                    detail: `${source.sourceKind}:${source.sourceSlot}`,
                    from: current.activeTab,
                })
            ));
            return;
        }
        const closesCurrentQuickEditor = quickEditorSource?.sourceKind === source.sourceKind
            && quickEditorSource.sourceSlot === source.sourceSlot;
        // Keep the selected editor binding in the same React batch as the
        // sheet source. Env 2 must never render one frame of Env 1 values,
        // and an MSEG switch must immediately use that slot's rate/shape.
        if (source.sourceKind === "mseg") {
            if (!closesCurrentQuickEditor) {
                synthView.msegEditor.beginEditorSession();
            }
            synthView.handleSelectMsegSlot(source.sourceSlot - 1);
        } else if (source.sourceKind === "env") {
            synthView.handleSelectEnvelopeSlot(source.sourceSlot - 1);
        }
        setQuickEditorSource(closesCurrentQuickEditor ? null : source);
    }, [
        mobileWorkspaceSection,
        quickEditorSource,
        synthView.handleSelectEnvelopeSlot,
        synthView.handleSelectMsegSlot,
        synthView.msegEditor.beginEditorSession,
    ]);
    const handleGlobalModSourceDrop = useCallback((source: GlobalModRailState["selectedSource"]) => {
        if (mobileWorkspaceSection === "mod" && synthView.msegEditor.isOpen) {
            setOpenMsegEditorTargetSlot(synthView.selectedMsegSlot);
        }
        setGlobalModRailState((current) => ({ ...current, selectedSource: source }));
    }, [mobileWorkspaceSection, synthView.msegEditor.isOpen, synthView.selectedMsegSlot]);
    const handleGlobalModSourceSelect = useCallback((source: GlobalModRailState["selectedSource"]) => {
        setOpenMsegEditorTargetSlot(null);
        setGlobalModRailState((current) => ({ ...current, selectedSource: source }));
    }, []);
    const closeMsegEditor = useCallback(() => {
        setOpenMsegEditorTargetSlot(null);
        synthView.msegEditor.closeEditor();
    }, [synthView.msegEditor.closeEditor]);
    useEffect(() => {
        if (!synthView.msegEditor.isOpen) {
            setOpenMsegEditorTargetSlot(null);
        }
    }, [synthView.msegEditor.isOpen]);
    const closeQuickEditor = useCallback(() => setQuickEditorSource(null), []);
    const openQuickEditorFullEditor = useCallback(() => {
        const source = quickEditorSource;
        if (source === null) {
            return;
        }
        setQuickEditorSource(null);
        if (source.sourceKind === "mseg") {
            synthView.msegEditor.resumeEditorSession();
            return;
        }
        openMobileModSourceDetail(source);
    }, [openMobileModSourceDetail, quickEditorSource, synthView.msegEditor]);
    useEffect(() => {
        // The quick sheet belongs to Voice/FX; the Mod workspace shows the
        // full source panel instead.
        if (mobileWorkspaceSection === "mod") {
            setQuickEditorSource(null);
        }
    }, [mobileWorkspaceSection]);
    const quickMacroCoerce = useCallback((rawValue: unknown) => clamp(Number(rawValue) || 0, 0, 1), []);
    const quickMacro1 = usePatchParameterBinding<number>({ endpointID: "macro1", initialValue: 0, coerce: quickMacroCoerce });
    const quickMacro2 = usePatchParameterBinding<number>({ endpointID: "macro2", initialValue: 0, coerce: quickMacroCoerce });
    const quickMacro3 = usePatchParameterBinding<number>({ endpointID: "macro3", initialValue: 0, coerce: quickMacroCoerce });
    const quickMacroBindings = [quickMacro1, quickMacro2, quickMacro3];

    const handleUniversalBack = useCallback(() => {
        if (synthView.msegEditor.isOpen) {
            closeMsegEditor();
            return;
        }
        setWorkspaceShell(universalBack);
    }, [closeMsegEditor, synthView.msegEditor.isOpen]);

    const resolveMobileVoiceScrollLocks = useCallback(() => (
        Array.from(workspacePanelsRef.current.values())
    ), []);
    const triggerMobileVoiceHaptic = useCallback(() => {
        const trigger = (globalThis as typeof globalThis & {
            cmaj_triggerHaptic?: (style?: string) => unknown;
        }).cmaj_triggerHaptic;
        trigger?.("light");
    }, []);
    const mobileVoiceBindings = useMemo<MobileVoiceEditorBindings>(() => ({
        framePosition: synthView.wavetablePosition,
        warpAmount: synthView.warpAmount,
        warpMode: synthView.warpMode,
        pan: synthView.pan,
        octave: synthView.oscillatorOctave,
        semitone: synthView.oscillatorSemitone,
        fineCents: synthView.oscillatorFineCents,
        volumeDb: synthView.oscillatorVolumeDb,
        mute: synthView.oscillatorMute,
        solo: synthView.oscillatorSolo,
        unisonVoices: synthView.unisonVoices,
        unisonDetune: synthView.unisonDetune,
        unisonBlend: synthView.unisonBlend,
        unisonWidth: synthView.unisonWidth,
        phase: synthView.unisonPhase,
        phaseRandom: synthView.unisonRandom,
        retrigger: synthView.unisonPhaseMode,
        unisonDetuneMode: synthView.unisonDetuneMode,
        unisonStackMode: synthView.unisonStackMode,
        unisonWavetablePositionSpread: synthView.unisonWavetablePositionSpread,
        unisonWarpSpread: synthView.unisonWarpSpread,
    }), [
        synthView.oscillatorFineCents,
        synthView.oscillatorMute,
        synthView.oscillatorOctave,
        synthView.oscillatorSemitone,
        synthView.oscillatorSolo,
        synthView.oscillatorVolumeDb,
        synthView.pan,
        synthView.unisonBlend,
        synthView.unisonDetune,
        synthView.unisonDetuneMode,
        synthView.unisonPhase,
        synthView.unisonPhaseMode,
        synthView.unisonRandom,
        synthView.unisonStackMode,
        synthView.unisonVoices,
        synthView.unisonWarpSpread,
        synthView.unisonWavetablePositionSpread,
        synthView.unisonWidth,
        synthView.warpAmount,
        synthView.warpMode,
        synthView.wavetablePosition,
    ]);

    const voiceWorkspace = (
        <>
        <section
            data-role="voice-visualization-stack"
            className="mobile-voice-grid grid min-h-0 grid-cols-1 items-stretch gap-4"
        >
            {isCompactViewport ? (
                <DesktopOscillatorConnectionBoundary
                    selectedOscillator={oscillatorSelection.selectedOscillator}
                    content={(
                        bounceController.state.sampled ? (
                            <BounceSampledSourceStage
                                state={bounceController.state}
                                lastPlayedNote={synthView.lastPlayedNote}
                                onBounce={() => void bounceController.bounce()}
                                onCancel={bounceController.cancel}
                                onRevert={() => void bounceController.revert()}
                                requestBounceGuard={requestBounceGuard}
                                compact
                                className="h-full"
                            />
                        ) : (
                        <MobileVoiceFocusedEditor
                            selection={oscillatorSelection}
                            bindings={mobileVoiceBindings}
                            stage={{
                                frames: synthView.frames,
                                position: synthView.observedPosition,
                                warpMode: synthView.observedWarpState.hasActive ? synthView.observedWarpState.mode : synthView.warpMode.value,
                                warpAmount: synthView.observedWarpState.hasActive ? synthView.observedWarpState.amount : synthView.warpAmount.value,
                                tableName: synthView.displayedTableName,
                                pendingTableName: synthView.runtimePresentation.isPendingSelection ? synthView.desiredTableName : null,
                                desiredTableIndex: synthView.desiredTableIndex,
                                tableOptions: synthView.tableOptions,
                                tableSelectionReady: synthView.callbackControlReadiness.wavetableSelection,
                                onTableChange: synthView.handleSelectWavetable,
                                onTablePrewarm: synthView.handlePrewarmWavetablePicker,
                                canRetry: synthView.canRetryDesiredTableLoad,
                                onRetry: synthView.handleRetryLoad,
                            }}
                            routes={synthView.routes}
                            armedSource={globalModRailState.selectedSource}
                            hudContainer={mobileVoiceHudLayer}
                            onRequestParameterMenu={openShellParameterMenu}
                            resolveScrollLockTargets={resolveMobileVoiceScrollLocks}
                            onRequestHaptic={triggerMobileVoiceHaptic}
                        >
                            <BounceActionControl
                                state={bounceController.state}
                                onBounce={() => void bounceController.bounce()}
                                onCancel={bounceController.cancel}
                                requestBounceGuard={requestBounceGuard}
                                compact
                                showReadyAction={false}
                            />
                        </MobileVoiceFocusedEditor>
                        )
                    )}
                />
            ) : bounceController.state.sampled ? (
                <DesktopOscillatorConnectionBoundary
                    selectedOscillator={oscillatorSelection.selectedOscillator}
                    content={(
                        <BounceSampledSourceStage
                            state={bounceController.state}
                            lastPlayedNote={synthView.lastPlayedNote}
                            onBounce={() => void bounceController.bounce()}
                            onCancel={bounceController.cancel}
                            onRevert={() => void bounceController.revert()}
                            requestBounceGuard={requestBounceGuard}
                            className={DESKTOP_VOICE_VISUALIZATION_CARD_CLASS}
                        />
                    )}
                />
            ) : (
            <DesktopOscillatorPresentation
                selection={oscillatorSelection}
                selectedOscillatorStage={(
                    <div className="relative min-w-0">
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
                        tableSelectionReady={synthView.callbackControlReadiness.wavetableSelection}
                        canRetry={synthView.canRetryDesiredTableLoad}
                        onTableChange={synthView.handleSelectWavetable}
                        onTablePrewarm={synthView.handlePrewarmWavetablePicker}
                        onRetry={synthView.handleRetryLoad}
                        tableFocusBindings={synthView.keyboardRouting.wavetableFocusBindings}
                        onPointerDown={synthView.stageBindings.handleStagePointerDown}
                        onPointerMove={synthView.stageBindings.handleStagePointerMove}
                        onPointerUp={synthView.stageBindings.handleStagePointerUp}
                        modulationTargetKind={oscillatorModulationTargetKind(
                            oscillatorSelection.selectedOscillatorID,
                            "wavetablePosition",
                        )}
                        bottomLeftAccessory={warpControlCluster}
                        bottomRightAccessory={panField}
                        className={DESKTOP_VOICE_VISUALIZATION_CARD_CLASS}
                    />
                    <div className="absolute right-3 top-3 z-30">
                        <BounceActionControl
                            state={bounceController.state}
                            onBounce={() => void bounceController.bounce()}
                            onCancel={bounceController.cancel}
                            requestBounceGuard={requestBounceGuard}
                            showReadyAction={false}
                        />
                    </div>
                    </div>
                )}
            />
            )}

            <VoiceToneSection
                filterMode={synthView.filterMode}
                filterCutoff={synthView.filterCutoff}
                filterCutoffKeyTrackEnabled={synthView.filterCutoffKeyTrackEnabled}
                filterCutoffKeyTrackOffsetSemitones={synthView.filterCutoffKeyTrackOffsetSemitones}
                filterQ={synthView.filterQ}
                voiceEnhancerFrequency={synthView.voiceEnhancerFrequency}
                voiceEnhancerQ={synthView.voiceEnhancerQ}
                voiceEnhancerAmount={synthView.voiceEnhancerAmount}
                voiceEnhancerKeyTrackEnabled={synthView.voiceEnhancerKeyTrackEnabled}
                voiceEnhancerKeyTrackOffsetSemitones={synthView.voiceEnhancerKeyTrackOffsetSemitones}
                observedFilterState={synthView.observedFilterState}
                observedFilterSpectrum={synthView.observedFilterSpectrum}
                resonanceNormalizedFromQ={resonanceNormalizedFromQ}
                resonanceQFromSurface={resonanceQFromSurface}
                resonanceCurveDebugState={filterResonanceCurveProfile}
                className={isCompactViewport ? "" : DESKTOP_VOICE_VISUALIZATION_CARD_CLASS}
                compact={isCompactViewport}
                filterMix={synthView.filterMix}
                routes={synthView.routes}
                armedSource={globalModRailState.selectedSource}
            />
        </section>
        {/* T05: the articulation/controls pane leaves compact mobile; the
            wavetable editor and filter split the freed height 50/50. */}
        {isCompactViewport ? null : (
            <section
                data-role="keyboard-controls"
                data-section-accent="lime"
                data-liquid-detail="edge-rail"
                className={`${SYNTH_GRID_CARD_SHELL_CLASS} min-w-0 border p-3`}
            >
                <div className="grid min-w-0 grid-cols-1 gap-3">
                    {keyboardToolbarOverride}
                </div>
            </section>
        )}
        </>
    );

    const modulationWorkspace = (
        <>
            {synthView.failureDetail ? (
                <div className="rounded-[22px] border border-fuchsia-300/15 bg-fuchsia-300/8 px-4 py-3 text-sm text-fuchsia-100/90">
                    {synthView.failureDetail}
                </div>
            ) : null}

            <section className={`grid min-h-0 items-stretch ${isCompactViewport ? "mobile-mod-workspace gap-2" : "gap-4 md:grid-cols-2"}`}>
                {isCompactViewport ? (
                    <MobileModWorkspacePager
                        focusSourceSerial={modPagerFocusSerial}
                        sourcePanel={(
                        <ModulationMatrixSection
                            compact={isCompactViewport}
                            focusedSource={mobileModSource}
                            // A valid source drop pins an already-open MSEG
                            // editor's target while the dropped source becomes
                            // its route source. Ordinary rail/page selections
                            // clear that pin and retain the existing behavior;
                            // hidden Mod pages still suspend this sync.
                            armedSource={mobileWorkspaceSection === "mod"
                                ? openMsegEditorTargetSlot === null
                                    ? globalModRailState.selectedSource
                                    : { sourceKind: "mseg", sourceSlot: openMsegEditorTargetSlot + 1 }
                                : null}
                            onArmSource={isCompactViewport ? handleArmModSource : undefined}
                            selectedMsegSlot={synthView.selectedMsegSlot}
                            msegState={synthView.msegState}
                            selectedMsegMorph={synthView.selectedMsegMorph}
                            callbackControlReadiness={synthView.callbackControlReadiness}
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
                            msegDirectEditing={{
                                sharedSurfaceRef: msegEditorSurfaceRef,
                                selectedPointIndex: synthView.msegEditor.selectedPointIndex,
                                hoveredSegmentIndex: synthView.msegEditor.hoveredSegmentIndex,
                                activeSegmentIndex: synthView.msegEditor.activeSegmentIndex,
                                onPointerDown: synthView.msegEditor.handlePointerDown,
                                onPointerMove: synthView.msegEditor.handlePointerMove,
                                onPointerLeave: synthView.msegEditor.handlePointerLeave,
                                onPointerUp: synthView.msegEditor.handlePointerUp,
                            }}
                        />
                        )}
                        mappingsPanel={(
                            <MobileModMappingsPanel
                                routes={synthView.routes}
                                recentConfirmedRouteId={recentConfirmedRouteId}
                                hudContainer={mobileVoiceHudLayer}
                                resolveScrollLockTargets={resolveMobileVoiceScrollLocks}
                                onRequestHaptic={triggerMobileVoiceHaptic}
                                onCreateRoute={synthView.handleAddRouteWithOverrides}
                                onRemoveRoute={synthView.handleRemoveRoute}
                                onRouteChange={synthView.handleRouteChange}
                                oscillatorTargetsInactive={bounceController.state.sampled}
                            />
                        )}
                    />
                ) : (
                    <ModulationMatrixSection
                        compact={isCompactViewport}
                        focusedSource={mobileModSource}
                        armedSource={isCompactViewport ? globalModRailState.selectedSource : null}
                        onArmSource={isCompactViewport ? handleArmModSource : undefined}
                        selectedMsegSlot={synthView.selectedMsegSlot}
                        msegState={synthView.msegState}
                        selectedMsegMorph={synthView.selectedMsegMorph}
                        callbackControlReadiness={synthView.callbackControlReadiness}
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
                )}

                {isCompactViewport ? null : (
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
                            oscillatorTargetsInactive={bounceController.state.sampled}
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
            polishEnhancerAmount={synthView.polishEnhancerAmount}
            polishCompressionClipAmount={synthView.polishCompressionClipAmount}
            polishOutputTrimDb={synthView.polishOutputTrimDb}
            onAddRouteWithOverrides={synthView.handleAddRouteWithOverrides}
            onRemoveRoute={synthView.handleRemoveRoute}
            onRouteChange={synthView.handleRouteChange}
            onModSourceTap={handleMobileModSourceTap}
            modSourceTapMode={isCompactViewport && mobileWorkspaceSection !== "mod"
                ? "toggle-quick-source"
                : "select-then-open"}
            onGlobalModRailStateChange={setGlobalModRailState}
            onGlobalModSourceDragChange={setGlobalModDragSource}
            onGlobalModSourceSelect={handleGlobalModSourceSelect}
            onGlobalModSourceDrop={handleGlobalModSourceDrop}
            selectModSourceSignal={armModSourceSignal}
            onRouteCreationConfirmed={handleRouteCreationConfirmed}
            onSelectedEffectChange={setSelectedRackEffectId}
            mobileGlobalModRail={isCompactViewport}
            mobileModRailPortalTarget={mobileModRailPortalTarget}
            modBarPreferences={modBarPreferences}
            globalModSourceActivity={globalModSourceActivity}
            modRailAudition={modRailAudition}
            modRailVoiceSettings={modRailVoiceSettings}
            onDragDwellNavigate={handleDragDwellNavigate}
            onBackToVoice={() => {
                if (isCompactViewport) {
                    activateWorkspaceTab("voice");
                    return;
                }
                scrollRegionRef.current?.scrollTo({ top: 0, behavior: "smooth" });
            }}
        />
    );

    return (
        <ParameterHudSuppressionProvider>
        <ParameterHudLayerContext.Provider value={mobileVoiceHudLayer}>
        <ParameterMenuContext.Provider value={openShellParameterMenu}>
        <div className={`cosimo-surface relative flex h-full w-full flex-col gap-3 overflow-hidden rounded-[28px] border border-white/[0.05] px-4 pb-4 pt-2.5 text-slate-100${isCompactViewport ? " is-mobile-shell" : ""}${isMobileEffectsPage ? " is-mobile-effects-page" : ""}`}>
            {!isCompactViewport ? <StatusHeader statusText={synthView.topStatus} /> : null}
            <SynthPresetBarHost
                isHidden={synthView.msegEditor.isOpen && !isCompactViewport}
                focusedEditorOpen={isCompactViewport && synthView.msegEditor.isOpen}
                storedStateAdapters={synthView.presetStoredStateAdapters}
                wavetableTables={synthView.tableOptions}
                polishMeter={synthView.observedPolishMeter}
                compactSynth={isCompactViewport}
                backAvailable={synthView.msegEditor.isOpen || mobileReturnTarget !== null}
                onShellBack={handleUniversalBack}
                perfTuningAvailable={PERF_TUNING_AVAILABLE}
                onOpenPerfTuning={openPerfTuning}
                onBounceGuardReady={handleBounceGuardReady}
                bounceAudioAvailable={bounceController.state.hydrated
                    && bounceController.state.captureReady
                    && !bounceController.state.busy}
                onBounceAudio={() => void bounceController.bounce()}
                onBounceVideo={handleBounceVideo}
            />
            {PerfTuningPage !== null && perfTuningOpen ? (
                <Suspense fallback={null}>
                    <PerfTuningPage onClose={closePerfTuning} />
                </Suspense>
            ) : null}

            {isCompactViewport ? (
                <main
                    data-role="mobile-workspace-panels"
                    className="mobile-workspace-panels min-h-0 flex-1"
                >
                    {([
                        { id: "voice" as const, content: voiceWorkspace },
                        {
                            id: "fx" as const,
                            content: (
                                <div data-role="mobile-effects-region" className="min-h-0 h-full overflow-hidden">
                                    {effectsRackWorkspace}
                                </div>
                            ),
                        },
                        { id: "mod" as const, content: modulationWorkspace },
                    ]).map(({ id, content }) => {
                        const isActive = id === mobileWorkspaceSection;
                        return (
                            <div
                                key={id}
                                ref={(element) => {
                                    if (element) {
                                        workspacePanelsRef.current.set(id, element);
                                    } else {
                                        workspacePanelsRef.current.delete(id);
                                    }
                                }}
                                id={`mobile-workspace-panel-${id}`}
                                data-role={`mobile-workspace-panel-${id}`}
                                role="tabpanel"
                                aria-labelledby={`mobile-workspace-tab-${id}`}
                                className={`mobile-workspace-panel${id === "fx" ? " is-fx-panel" : ""}`}
                                hidden={!isActive}
                                aria-hidden={!isActive}
                                inert={!isActive}
                            >
                                {content}
                            </div>
                        );
                    })}
                </main>
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

            {/* The one precision-HUD layer: every parameter control (cells
                and knobs, compact AND desktop) portals its HUD here. */}
            <div
                ref={setMobileVoiceHudLayer}
                data-role="mobile-voice-hud-layer"
                className="pointer-events-none absolute inset-0 z-40"
                aria-hidden={false}
            />

            {isCompactViewport ? (
                <div
                    ref={mobileBottomDockRef}
                    data-role="mobile-bottom-dock"
                    data-mod-bar-placement={modBarPreferences.placement}
                    data-parked-visibility={modBarPreferences.parkedVisibility}
                    data-mseg-drawer-open={quickEditorSource?.sourceKind === "mseg"}
                    className="mobile-bottom-dock"
                >
                    <div
                        ref={setMobileModRailPortalTarget}
                        data-role="mobile-global-mod-rail-portal"
                        className="mobile-global-mod-rail-portal"
                        aria-hidden={false}
                    />
                    {!synthView.msegEditor.isOpen ? (
                        <MobileWorkspaceTabs
                            activeTab={mobileWorkspaceSection}
                            onActivateTab={activateWorkspaceTab}
                            onTapActiveTab={tapActiveWorkspaceTab}
                        />
                    ) : null}
                </div>
            ) : null}

            <div
                data-role="sticky-keyboard"
                className="relative z-20 min-w-0 shrink-0 border-t border-white/[0.05] pt-3"
                style={keyboardVisible && !(isCompactViewport && synthView.msegEditor.isOpen)
                    ? undefined
                    : { display: "none" }}
            >
                <KeyboardSection
                    oscillatorID={oscillatorSelection.selectedOscillatorID}
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
                    onIntentionalNote={synthView.trackIntentionalNoteInput}
                    toolbarOverride={false}
                />
            </div>

            {isCompactViewport && quickEditorSource !== null && mobileWorkspaceSection !== "mod" ? (
                <MobileQuickSourceSheet
                    source={quickEditorSource}
                    armedSource={activeMsegRouteSourceIdentity}
                    routes={synthView.routes}
                    hudContainer={mobileVoiceHudLayer}
                    resolveScrollLockTargets={resolveMobileVoiceScrollLocks}
                    onRequestHaptic={triggerMobileVoiceHaptic}
                    msegSurface={synthView.msegState === null ? null : (
                        <EditableMsegSurface
                            surfaceRef={msegEditorSurfaceRef}
                            points={synthView.msegState.shape.points}
                            referencePoints={synthView.msegState.referenceShape?.points ?? null}
                            morphShapeAPoints={synthView.msegState.shapeA?.points ?? null}
                            morphShapeBPoints={synthView.msegState.shapeB?.points ?? null}
                            morphValue={synthView.selectedMsegMorph.value}
                            realizedMorphEmphasis={isQuickMsegMorphAdjusting ? "active" : "resting"}
                            editShapeIndex={synthView.msegState.editShapeIndex ?? 0}
                            selectedPointIndex={synthView.msegEditor.selectedPointIndex}
                            hoveredSegmentIndex={synthView.msegEditor.hoveredSegmentIndex}
                            activeSegmentIndex={synthView.msegEditor.activeSegmentIndex}
                            orientation={msegSurfaceOrientation}
                            timeAxisScale={{
                                kind: "seconds",
                                totalSeconds: synthView.msegState.playback.rate.seconds,
                            }}
                            onOrientationChange={setMsegSurfaceOrientation}
                            onPointerDown={synthView.msegEditor.handlePointerDown}
                            onPointerMove={synthView.msegEditor.handlePointerMove}
                            onPointerLeave={synthView.msegEditor.handlePointerLeave}
                            onPointerUp={synthView.msegEditor.handlePointerUp}
                            className="h-full w-full"
                            dataRole="quick-sheet-mseg-surface"
                        />
                    )}
                    envelopeSurface={synthView.selectedEnvelope === null ? null : (
                        <DesktopEnvelopeEditor
                            selectedEnvelope={synthView.selectedEnvelope}
                            onEnvelopeChange={synthView.handleEnvelopeChange}
                            readiness={synthView.callbackControlReadiness.envelope}
                            releaseMinimumSeconds={envelopeReleaseMinimumSeconds(synthView.selectedEnvelopeSlot)}
                            compact
                        />
                    )}
                    msegRateBinding={synthView.selectedMsegRate}
                    msegEditShapeIndex={synthView.msegState?.editShapeIndex ?? 0}
                    onSelectMsegShape={synthView.handleSelectMsegShape}
                    msegMorphBinding={synthView.selectedMsegMorph}
                    msegMorphShapeAPoints={synthView.msegState?.shapeA?.points ?? null}
                    msegMorphShapeBPoints={synthView.msegState?.shapeB?.points ?? null}
                    onMsegMorphAdjustingChange={setIsQuickMsegMorphAdjusting}
                    msegLoopEnabled={synthView.msegState?.playback.loop !== null}
                    onToggleMsegLoop={synthView.handleToggleMsegLoop}
                    envelope={synthView.selectedEnvelope}
                    envelopeReadiness={synthView.callbackControlReadiness.envelope}
                    onEnvelopeChange={synthView.handleEnvelopeChange}
                    macroBinding={quickEditorSource.sourceKind === "macro"
                        ? quickMacroBindings[quickEditorSource.sourceSlot - 1] ?? null
                        : null}
                    onRequestParameterMenu={openShellParameterMenu}
                    onLayoutHeightChange={quickEditorSource.sourceKind === "mseg"
                        ? handleQuickMsegDrawerHeightChange
                        : undefined}
                    onClose={closeQuickEditor}
                    onOpenFullEditor={openQuickEditorFullEditor}
                />
            ) : null}

            {parameterMenuOverlays}

            {videoBounceRequest ? (
                <VideoBounceFlow
                    patchInput={videoBounceRequest.patchInput}
                    onClose={() => setVideoBounceRequest(null)}
                />
            ) : null}

            <MsegEditorModal
                isOpen={synthView.msegEditor.isOpen}
                compactShellBack={isCompactViewport}
                slotIndex={synthView.selectedMsegSlot}
                slotLabel={`MSEG ${synthView.selectedMsegSlot + 1}`}
                msegState={synthView.msegState}
                morphBinding={synthView.selectedMsegMorph}
                rateBinding={synthView.selectedMsegRate}
                surfaceRef={msegEditorSurfaceRef}
                selectedPointIndex={synthView.msegEditor.selectedPointIndex}
                hoveredSegmentIndex={synthView.msegEditor.hoveredSegmentIndex}
                activeSegmentIndex={synthView.msegEditor.activeSegmentIndex}
                canUndo={synthView.msegEditor.canUndo}
                onClose={closeMsegEditor}
                onUndo={synthView.msegEditor.undoLastEdit}
                onSelectShape={synthView.handleSelectMsegShape}
                onToggleLoop={synthView.handleToggleMsegLoop}
                onPointerDown={synthView.msegEditor.handlePointerDown}
                onPointerMove={synthView.msegEditor.handlePointerMove}
                onPointerLeave={synthView.msegEditor.handlePointerLeave}
                onPointerUp={synthView.msegEditor.handlePointerUp}
                rateFocusBindings={synthView.keyboardRouting.msegRateFocusBindings}
                orientation={msegSurfaceOrientation}
                onOrientationChange={setMsegSurfaceOrientation}
                routes={synthView.routes}
                armedSource={activeMsegRouteSourceIdentity}
                resolveScrollLockTargets={resolveMobileVoiceScrollLocks}
                onRequestParameterMenu={openShellParameterMenu}
            />

            <ContextualArticulationToolbar
                articulationIsDirty={oscillatorSelection.selectedOscillatorID === "A"
                    && synthView.selectedArticulationIsDirty}
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
        </ParameterMenuContext.Provider>
        </ParameterHudLayerContext.Provider>
        </ParameterHudSuppressionProvider>
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
