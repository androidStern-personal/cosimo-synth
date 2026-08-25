import {
    useCallback,
    useEffect,
    useMemo,
    useRef,
    useState,
    useSyncExternalStore,
    type PointerEvent as ReactPointerEvent,
    type RefObject,
} from "react";
import { useLaneParameterBinding } from "./lane-param-bindings";
import { getRackParameterDescriptor } from "./rack-parameter-descriptors";

import {
    usePatchConnection,
    usePatchEndpoint,
    usePatchVisualEndpoint,
    useResourceClient,
} from "./cmajor-react";
import {
    usePatchEventTrigger,
    usePatchParameterBinding,
    type PatchControlBinding,
} from "./patch-controls";
import { runProgrammaticWrites, subscribeToUserEdits } from "./user-edit-bus";
import { createAutoPreviewEngine, type AutoPreviewEngine } from "./auto-preview-engine";
import { createAutoPreviewScheduler } from "./auto-preview-scheduler";
import { createPreviewStrategyEngine } from "./auto-preview-strategies";
import { PERF_TUNING_AVAILABLE, getPerfTuningState, subscribePerfTuning } from "./perf-tuning";
import { createPreviewNoteMemory } from "./preview-note-memory";
import { clearUiTimeout, uiTimeout } from "./ui-timers";
import {
    AUTO_PREVIEW_SYNC_CONFIG,
    quantizeStrikeTime,
    type AutoPreviewStrikeKind,
    type LoopSyncSource,
} from "./auto-preview-sync";
import {
    deriveMsegSegmentCurvePower,
    clampMsegRateSeconds,
    findMsegPointHitIndex,
    findMsegSegmentHitIndex,
    msegEditorCoordinatesToPoint,
    type MsegSurfaceOrientation,
    type MsegShape,
    type MsegState,
} from "./mseg";
import {
    MODULATION_STATE_KEY,
    MODULATION_STATE_VERSION,
    MODULATION_TARGET_OPTIONS,
    acquireModulationRuntimeBridge,
    buildDisplayedMsegState,
    clampModulationRouteAmount,
    createDefaultModulationState,
    createDefaultEnvelope,
    createFirstAvailableModulationRoute,
    normalizeModulationState,
    parseModulationState,
    releaseModulationRuntimeBridge,
    serializeModulationState,
    type ModulationEnvelope,
    type GeneratedModulationRouteInput,
    type ModulationRoute,
    type ModulationRouteUpdate,
    type ModulationState,
    type ModulationStateChangeKind,
    type MsegEditorControllerLike,
} from "./modulation";
import { isOscillatorModulationTargetKind } from "./modulation-targets";
import { getModulationArticulationCellIndex } from "./modulation-runtime-program";
import type {
    EffectStoredStateAdapter,
    EffectStoredStateContext,
} from "./effects/effect-preset-v2";
import {
    ARTICULATIONS_V4_STATE_KEY,
    createEmptyArticulationsState,
    parseArticulationsV4,
    serializeArticulationsV4,
    type ArticulationSlotV4,
    type ArticulationsState,
    type ArticulationVoiceParameterId,
    type OscillatorArticulationParameterId,
} from "./articulation-image";
import { createBouncePresetStoredStateAdapter } from "./bounce-preset-state";
import {
    articulationEditorStatesEqual,
    articulationSnapshotsEqual,
    createDefaultArticulationEditorState,
    createDefaultArticulationSnapshot,
    normalizeArticulationEditorState,
    normalizeArticulationSnapshot,
    type ArticulationEditorState,
    type ArticulationInsertPreserveSide,
    type ArticulationRangeAssignment,
    type ArticulationRangeEditEdge,
    type ArticulationSlot,
    type ArticulationSnapshot,
    type ArticulationTriggerMode,
} from "./articulations";
import {
    addCapturedArticulationV4,
    assignArticulationPositionV4,
    collapseAllArticulationSegmentsV4,
    collapseArticulationSegmentV4,
    deleteArticulationV4,
    diffCapturedArticulationLayerV4,
    distributeArticulationSegmentsV4,
    duplicateArticulationV4,
    insertArticulationPositionV4,
    moveArticulationSegmentV4,
    renameArticulationV4,
    replaceVisibleArticulationLayerV4,
    resizeArticulationSegmentV4,
    selectArticulationV4,
    setArticulationTriggerModeV4,
    type CapturedArticulationLayer,
} from "./articulation-v4-editor";
import {
    clampDisplayPosition,
    describeRuntimeTableFailureDetails,
    FILTER_MODE_LOWPASS,
    mapDisplayDragToPosition,
    normalizeRuntimeTableState,
    resolveRuntimeTablePresentation,
    selectObservedEffectiveUnisonState,
    selectObservedEffectiveFilterState,
    selectObservedEffectiveWarpState,
    selectObservedWavetablePositionState,
    type EffectiveFilterState,
    type EffectiveUnisonState,
    type EffectiveWarpState,
    type RuntimeTablePresentation,
} from "./runtime-table-state";
import {
    normalizeFilterSpectrumMessage,
    type FilterSpectrumFrame,
} from "./filter-spectrum";
import {
    DISTORTION_HISTORY_ENDPOINT_ID,
    DISTORTION_SCOPE_ENDPOINT_ID,
    normalizeDistortionHistoryMessage,
    normalizeDistortionScopeMessage,
    type DistortionHistoryFrame,
    type DistortionScopeFrame,
} from "./distortion-visualization";
import {
    EFFECTIVE_MSEG_STATE_ENDPOINT_ID,
    normalizeEffectiveMsegStateMessage,
    resolveMsegPreviewPlayheadState,
    selectObservedEffectiveMsegState,
    type EffectiveMsegState,
    type MsegPreviewPlayheadState,
} from "./mseg-monitor";
import {
    useSynthInputRouter,
    type ArrowStepDirection,
    type SynthFocusBindings,
    type SynthKeyboardInputMode,
    type SynthKeyboardLike,
} from "./synth-input-router";
import {
    BROWSER_AUDIO_LEAVE_EVENT,
    BROWSER_AUDIO_RETURN_EVENT,
} from "./browser-audio-events";
import {
    DEFAULT_FACTORY_TABLE_INDEX,
    loadFactoryBankCatalog,
    loadFactoryBankFrames,
    type FactoryBankCatalog,
} from "./wavetable-bank";
import {
    DEFAULT_SELECTED_OSCILLATOR_ID,
    OSCILLATOR_BINDING_CONTRACTS,
    getOscillatorBindingContract,
    getOscillatorControlAddress,
    projectSelectedOscillatorWrite,
    type OscillatorControlID,
    type OscillatorControlWrite,
    type OscillatorID,
    type OscillatorRuntimeIndex,
    type OscillatorSelectionViewModel,
} from "./oscillator-binding";

function requireLaneParameterDescriptor(endpointID: string) {
    const descriptor = getRackParameterDescriptor(endpointID);
    if (descriptor === null) {
        throw new Error(`Unknown lane parameter descriptor: ${endpointID}`);
    }
    return descriptor;
}


export const EFFECTIVE_WAVETABLE_POSITION_ENDPOINT_ID = "effectiveWavetablePosition";
export const EFFECTIVE_WARP_STATE_ENDPOINT_ID = "effectiveWarpState";
export const EFFECTIVE_UNISON_STATE_ENDPOINT_ID = "effectiveUnisonState";
export const EFFECTIVE_FILTER_STATE_ENDPOINT_ID = "effectiveFilterState";
export const FILTER_SPECTRUM_ENDPOINT_ID = "filterSpectrum";
export const DISPLAY_SWIPE_THRESHOLD_PX = 2;
export const MSEG_DRAG_THRESHOLD_PX = 8;
const PLAY_MODE_ENDPOINT_ID = "playMode";
const GLIDE_TIME_ENDPOINT_ID = "glideTime";
const FILTER_MODE_ENDPOINT_ID = "filterMode";
const FILTER_CUTOFF_ENDPOINT_ID = "filterCutoff";
const FILTER_Q_ENDPOINT_ID = "filterQ";
const FILTER_MIX_ENDPOINT_ID = "filterMix";
const MSEG_1_MORPH_ENDPOINT_ID = "mseg1Morph";
const MSEG_2_MORPH_ENDPOINT_ID = "mseg2Morph";
const MSEG_3_MORPH_ENDPOINT_ID = "mseg3Morph";
const MSEG_1_RATE_ENDPOINT_ID = "mseg1Rate";
const MSEG_2_RATE_ENDPOINT_ID = "mseg2Rate";
const MSEG_3_RATE_ENDPOINT_ID = "mseg3Rate";
const ENV_1_ATTACK_ENDPOINT_ID = "env1Attack";
const ENV_1_DECAY_ENDPOINT_ID = "env1Decay";
const ENV_1_SUSTAIN_ENDPOINT_ID = "env1Sustain";
const ENV_1_RELEASE_ENDPOINT_ID = "env1Release";
const ENV_2_ATTACK_ENDPOINT_ID = "env2Attack";
const ENV_2_DECAY_ENDPOINT_ID = "env2Decay";
const ENV_2_SUSTAIN_ENDPOINT_ID = "env2Sustain";
const ENV_2_RELEASE_ENDPOINT_ID = "env2Release";
const ENV_3_ATTACK_ENDPOINT_ID = "env3Attack";
const ENV_3_DECAY_ENDPOINT_ID = "env3Decay";
const ENV_3_SUSTAIN_ENDPOINT_ID = "env3Sustain";
const ENV_3_RELEASE_ENDPOINT_ID = "env3Release";
const DISTORTION_MODE_ENDPOINT_ID = "distortionMode";
const DISTORTION_DRIVE_DB_ENDPOINT_ID = "distortionDriveDb";
const DISTORTION_KNEE_ENDPOINT_ID = "distortionKnee";
const DISTORTION_WET_ENDPOINT_ID = "distortionWet";
const DISTORTION_WET_HP_HZ_ENDPOINT_ID = "distortionWetHPHz";
const DISTORTION_WET_LP_HZ_ENDPOINT_ID = "distortionWetLPHz";
const DISTORTION_TYPE_ENDPOINT_ID = "distortionType";
const CHORUS_MIX_ENDPOINT_ID = "chorusMix";
const CHORUS_MOTION_MODE_ENDPOINT_ID = "chorusMotionMode";
const CHORUS_BLOOM_MODE_ENDPOINT_ID = "chorusBloomMode";
const CHORUS_TONE_ENDPOINT_ID = "chorusTone";
const CHORUS_FEEDBACK_ENDPOINT_ID = "chorusFeedback";
const CHORUS_RING_AMOUNT_ENDPOINT_ID = "chorusRingAmount";
const CHORUS_RING_OFFSET_MODE_ENDPOINT_ID = "chorusRingOffsetMode";
const CHORUS_RING_FINE_SEMITONES_ENDPOINT_ID = "chorusRingFineSemitones";
const RUNTIME_SYNC_REQUEST_ENDPOINT_ID = "runtimeSyncRequest";
const RUNTIME_STATE_ENDPOINT_ID = "runtimeState";
const RETRY_DESIRED_TABLE_REQUEST_ENDPOINT_ID = "retryDesiredTableRequest";
const WAVETABLE_PREWARM_REQUEST_ENDPOINT_ID = "wavetablePrewarmRequest";
const MIDI_INPUT_ENDPOINT_ID = "midiIn";
/** T12 locked starting cadence; tune on a real phone before shipping. */
const AUTO_PREVIEW_SCHEDULER_CONFIG = {
    minRetriggerIntervalMs: 250,
    movementStoppedMs: 150,
    releaseNoteCapMs: 600,
} as const;
/** A preview released in the instant it started still gets a brief audible life. */
const AUTO_PREVIEW_MIN_NOTE_MS = 250;
const VOICE_ARTICULATION_START_ENDPOINT_ID = "voiceArticulationStart";
const ARTICULATION_AUDITION_FALLBACK_NOTE = 60;
export { SYNTH_PRESET_EFFECT_ID } from "./effects/synth-preset-identity";
export const GLIDE_TIME_MIN_SECONDS = 0;
export const GLIDE_TIME_MAX_SECONDS = 2;
export const GLIDE_TIME_STEP_SECONDS = 0.001;

type ActiveMsegPointPointerState = {
    kind: "point-drag";
    pointerId: number;
    pointIndex: number;
    startClientX: number;
    startClientY: number;
    moved: boolean;
    deleteOnRelease: boolean;
};

type ActiveMsegPendingSegmentPointerState = {
    kind: "pending-segment";
    pointerId: number;
    segmentIndex: number;
    startClientX: number;
    startClientY: number;
    holdTimeoutId: number | null;
};

type ActiveMsegCurvePointerState = {
    kind: "curve-drag";
    pointerId: number;
    segmentIndex: number;
};

type ActiveMsegPointerState =
    | ActiveMsegPointPointerState
    | ActiveMsegPendingSegmentPointerState
    | ActiveMsegCurvePointerState;

export type CatalogLoadState = {
    catalog: FactoryBankCatalog | null;
    error: string | null;
};

export type FrameLoadState = {
    frames: Float32Array[] | null;
    error: string | null;
};

export type SynthTextEntryFocusTarget = {
    onActivate: () => void;
    onBeginTextEntry: () => void;
    onEndTextEntry: () => void;
};

export type SynthKeyboardRoutingBindings = {
    wavetableFocusBindings: SynthFocusBindings;
    playModeFocusBindings: SynthFocusBindings;
    msegRateFocusBindings: SynthFocusBindings;
    glideFocusTarget: SynthTextEntryFocusTarget;
};

export type ArticulationHeldInput = {
    note: number | null;
    velocity: number | null;
    chain: number | null;
};

/**
 * Owns the presentation-only oscillator tab state shared by desktop and iPhone.
 * Selection changes which canonical A/B/C endpoints the shared controls bind.
 * It remains session-only presentation state and is never stored in the patch.
 */
export function useOscillatorSelectionViewModel(): OscillatorSelectionViewModel {
    const [selectedOscillatorID, selectOscillator] = useState(DEFAULT_SELECTED_OSCILLATOR_ID);
    const selectedOscillator = getOscillatorBindingContract(selectedOscillatorID);
    const projectControlWrite = useCallback((
        controlID: OscillatorControlID,
        value: number,
    ): OscillatorControlWrite => (
        projectSelectedOscillatorWrite(selectedOscillatorID, controlID, value)
    ), [selectedOscillatorID]);

    return useMemo(() => ({
        options: OSCILLATOR_BINDING_CONTRACTS,
        selectedOscillatorID,
        selectedOscillator,
        selectOscillator,
        projectControlWrite,
    }), [projectControlWrite, selectedOscillator, selectedOscillatorID]);
}

function runtimeStateOscillatorIndex(message: unknown): OscillatorRuntimeIndex | null {
    const payload = (message as { event?: unknown } | null | undefined)?.event ?? message;
    if (!payload || typeof payload !== "object") return null;
    const oscillatorIndex = Math.trunc(Number((payload as { oscillatorIndex?: unknown }).oscillatorIndex));
    return oscillatorIndex === 0 || oscillatorIndex === 1 || oscillatorIndex === 2
        ? oscillatorIndex
        : null;
}

/** Retains the most recent table state for each oscillator on the shared event stream. */
function useOscillatorRuntimeTableState(oscillatorIndex: OscillatorRuntimeIndex): unknown | null {
    const patchConnection = usePatchConnection();
    const [states, setStates] = useState<ReadonlyArray<unknown | null>>([null, null, null]);

    useEffect(() => {
        setStates([null, null, null]);
        const listener = (message: unknown) => {
            const messageOscillatorIndex = runtimeStateOscillatorIndex(message);
            if (messageOscillatorIndex === null) return;
            setStates((previousStates) => {
                const nextStates = [...previousStates];
                nextStates[messageOscillatorIndex] = message;
                return nextStates;
            });
        };

        patchConnection.addEndpointListener?.(RUNTIME_STATE_ENDPOINT_ID, listener);
        return () => patchConnection.removeEndpointListener?.(RUNTIME_STATE_ENDPOINT_ID, listener);
    }, [patchConnection]);

    return states[oscillatorIndex] ?? null;
}

type HeldMidiNote = {
    velocity: number;
    order: number;
};

type AutoPreviewOwnedGroup = {
    readonly pitches: ReadonlyArray<number>;
    readonly startedAt: number;
};

type VoiceArticulationStartMessage = {
    hasArticulation?: number | boolean;
    selectorA?: number;
};

export type SynthPatchViewModel = {
    frames: Float32Array[] | null;
    catalogError: string | null;
    frameError: string | null;
    observedPosition: number;
    topStatus: string;
    failureDetail: string | null;
    runtimePresentation: RuntimeTablePresentation;
    displayedTableIndex: number;
    displayedTableName: string;
    displayedFrameCount: number;
    desiredTableIndex: number;
    desiredTableName: string;
    tableOptions: FactoryBankCatalog["tables"];
    canRetryDesiredTableLoad: boolean;
    wavetablePosition: PatchControlBinding<number>;
    playMode: PatchControlBinding<number>;
    glideTime: PatchControlBinding<number>;
    pan: PatchControlBinding<number>;
    oscillatorOctave: PatchControlBinding<number>;
    oscillatorSemitone: PatchControlBinding<number>;
    oscillatorFineCents: PatchControlBinding<number>;
    oscillatorVolumeDb: PatchControlBinding<number>;
    oscillatorMute: PatchControlBinding<number>;
    oscillatorSolo: PatchControlBinding<number>;
    warpMode: PatchControlBinding<number>;
    warpAmount: PatchControlBinding<number>;
    filterMode: PatchControlBinding<number>;
    filterCutoff: PatchControlBinding<number>;
    filterQ: PatchControlBinding<number>;
    filterMix: PatchControlBinding<number>;
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
    selectedMsegMorph: PatchControlBinding<number>;
    selectedMsegRate: PatchControlBinding<number>;
    distortionMode: PatchControlBinding<number>;
    distortionDriveDb: PatchControlBinding<number>;
    distortionKnee: PatchControlBinding<number>;
    distortionWet: PatchControlBinding<number>;
    distortionWetHPHz: PatchControlBinding<number>;
    distortionWetLPHz: PatchControlBinding<number>;
    distortionType: PatchControlBinding<number>;
    chorusMix: PatchControlBinding<number>;
    chorusMotionMode: PatchControlBinding<number>;
    chorusBloomMode: PatchControlBinding<number>;
    chorusTone: PatchControlBinding<number>;
    chorusFeedback: PatchControlBinding<number>;
    chorusRingAmount: PatchControlBinding<number>;
    chorusRingOffsetMode: PatchControlBinding<number>;
    chorusRingFineSemitones: PatchControlBinding<number>;
    observedFilterState: EffectiveFilterState;
    observedFilterSpectrum: FilterSpectrumFrame | null;
    observedDistortionHistory: DistortionHistoryFrame | null;
    observedDistortionScope: DistortionScopeFrame | null;
    observedMsegPlayhead: MsegPreviewPlayheadState;
    observedWarpState: EffectiveWarpState;
    observedUnisonState: EffectiveUnisonState;
    modulationState: ModulationState | null;
    articulationBank: ArticulationEditorState;
    articulationSlots: ArticulationSlot[];
    selectedArticulationSlot: ArticulationSlot | null;
    selectedArticulationIsDirty: boolean;
    presetStoredStateAdapters: EffectStoredStateAdapter[];
    articulationHeldInput: ArticulationHeldInput;
    discardedArticulationEdit: {
        slotId: string;
        slotName: string;
    } | null;
    hasHydratedArticulations: boolean;
    selectedMsegSlot: number;
    selectedEnvelopeSlot: number;
    selectedEnvelope: ModulationEnvelope | null;
    routes: ModulationRoute[];
    msegState: MsegState | null;
    handleSelectMsegSlot: (slotIndex: number) => void;
    handleSelectMsegShape: (shapeIndex: number) => void;
    handleSelectEnvelopeSlot: (slotIndex: number) => void;
    handleEnvelopeChange: (field: "attackSeconds" | "decaySeconds" | "sustain" | "releaseSeconds", nextValue: number) => void;
    handleAddRoute: () => void;
    handleAddRouteWithOverrides: (overrides: GeneratedModulationRouteInput) => boolean;
    handleRemoveRoute: (routeIndex: number) => void;
    handleRouteChange: (routeIndex: number, update: ModulationRouteUpdate) => void;
    handleAddArticulationSlot: () => void;
    handleCaptureArticulationSlot: (options?: { autoAssign?: boolean }) => void;
    handleSelectArticulationSlot: (slotId: string) => void;
    handleUpdateSelectedArticulationSlot: () => void;
    handleRevertSelectedArticulationSlot: () => void;
    handleUndoDiscardedArticulationEdit: () => void;
    handleSetArticulationTriggerMode: (mode: ArticulationTriggerMode) => void;
    handleAssignArticulationRangePosition: (mode: ArticulationTriggerMode, position: number, articulationId: string) => boolean;
    handleInsertArticulationRangeAtPosition: (
        mode: ArticulationTriggerMode,
        position: number,
        articulationId: string,
        preserveSide?: ArticulationInsertPreserveSide,
    ) => boolean;
    handleDuplicateAndAssignArticulationRangePosition: (
        mode: ArticulationTriggerMode,
        position: number,
        articulationId: string,
        operation: "assign" | "insert",
    ) => boolean;
    handleMoveArticulationRangeAssignment: (mode: ArticulationTriggerMode, segment: ArticulationRangeAssignment, targetPosition: number) => boolean;
    handleResizeArticulationRangeAssignment: (mode: ArticulationTriggerMode, segment: ArticulationRangeAssignment, edge: ArticulationRangeEditEdge, position: number) => boolean;
    handleClearArticulationRangeAssignment: (mode: ArticulationTriggerMode, segment: ArticulationRangeAssignment) => boolean;
    handleClearArticulationTriggerAssignments: (mode: ArticulationTriggerMode) => void;
    handleDistributeArticulationRanges: (mode: ArticulationTriggerMode) => void;
    handleRenameArticulationSlot: (slotId: string, nextName: string) => void;
    handleDuplicateArticulationSlot: (slotId: string) => void;
    handleDeleteArticulationSlot: (slotId: string) => void;
    handleReplaceArticulationSlotWithCurrent: (slotId: string) => void;
    handleStartArticulationAudition: (slotId: string) => void;
    handleStopArticulationAudition: (slotId?: string) => void;
    handleStartNoteKeyAudition: () => void;
    handleStopNoteKeyAudition: () => void;
    /** Feed one user-intentional MIDI note into last-played/held bookkeeping. */
    trackIntentionalNoteInput: (status: number, noteNumber: number, velocity?: number) => void;
    /** Last intentional note, used by sampled-source scopes to choose a root. */
    lastPlayedNote: number;
    handleSelectWavetable: (nextValue: number) => void;
    handlePrewarmWavetablePicker: () => void;
    handleRetryLoad: () => void;
    handleMsegMorphChange: (nextValue: number) => void;
    handleMsegRateChange: (nextValue: number) => void;
    handleToggleMsegLoop: () => void;
    stageBindings: {
        handleStagePointerDown: (event: ReactPointerEvent<HTMLDivElement>) => void;
        handleStagePointerMove: (event: ReactPointerEvent<HTMLDivElement>) => void;
        handleStagePointerUp: (event: ReactPointerEvent<HTMLDivElement>) => void;
    };
    msegEditor: ReturnType<typeof useMsegEditorInteractions>;
    keyboardRouting: SynthKeyboardRoutingBindings;
};

function describeErrorMessage(error: unknown) {
    if (error && typeof error === "object") {
        const maybeError = error as { stack?: string; message?: string };
        return maybeError.stack || maybeError.message || String(error);
    }

    return String(error);
}

function clamp(value: number, min: number, max: number) {
    return Math.min(Math.max(value, min), max);
}

export function useFactoryBankCatalog(): CatalogLoadState {
    const resourceClient = useResourceClient();
    const [state, setState] = useState<CatalogLoadState>({
        catalog: null,
        error: null,
    });

    useEffect(() => {
        let cancelled = false;

        void loadFactoryBankCatalog(resourceClient)
            .then((catalog) => {
                if (!cancelled) {
                    setState({
                        catalog,
                        error: null,
                    });
                }
            })
            .catch((error) => {
                if (!cancelled) {
                    setState({
                        catalog: null,
                        error: describeErrorMessage(error),
                    });
                }
            });

        return () => {
            cancelled = true;
        };
    }, [resourceClient]);

    return state;
}

export function useFactoryTableFrames(tableIndex: number): FrameLoadState {
    const resourceClient = useResourceClient();
    const [state, setState] = useState<FrameLoadState>({
        frames: null,
        error: null,
    });

    useEffect(() => {
        let cancelled = false;

        void loadFactoryBankFrames(resourceClient, { tableIndex })
            .then((nextFrames) => {
                if (!cancelled) {
                    setState({
                        frames: nextFrames.frames,
                        error: null,
                    });
                }
            })
            .catch((error) => {
                if (!cancelled) {
                    setState({
                        frames: null,
                        error: describeErrorMessage(error),
                    });
                }
            });

        return () => {
            cancelled = true;
        };
    }, [resourceClient, tableIndex]);

    return state;
}

export function useObservedDisplayPosition(parameterPosition: number) {
    const message = usePatchVisualEndpoint<unknown | null>(EFFECTIVE_WAVETABLE_POSITION_ENDPOINT_ID, null);
    const [observedState, setObservedState] = useState(() => ({
        voiceGeneration: -1,
        position: parameterPosition,
    }));

    useEffect(() => {
        setObservedState((previousState) => selectObservedWavetablePositionState(previousState, message));
    }, [message]);

    return message ? observedState.position : parameterPosition;
}

export function useObservedFilterState({
    filterMode,
    filterCutoff,
    filterQ,
}: {
    filterMode: number;
    filterCutoff: number;
    filterQ: number;
}) {
    const message = usePatchVisualEndpoint<unknown | null>(EFFECTIVE_FILTER_STATE_ENDPOINT_ID, null);
    const [observedState, setObservedState] = useState<EffectiveFilterState>(() => ({
        voiceGeneration: -1,
        hasActive: false,
        mode: Math.round(filterMode) || 0,
        cutoffHz: Number(filterCutoff) || 1000,
        q: Number(filterQ) || 0.707107,
    }));

    useEffect(() => {
        setObservedState((previousState) => selectObservedEffectiveFilterState(previousState, message));
    }, [message]);

    useEffect(() => {
        if (message) {
            return;
        }

        setObservedState({
            voiceGeneration: -1,
            hasActive: false,
            mode: Math.round(filterMode) || 0,
            cutoffHz: Number(filterCutoff) || 1000,
            q: Number(filterQ) || 0.707107,
        });
    }, [filterCutoff, filterMode, filterQ, message]);

    if (!message) {
        return {
            voiceGeneration: -1,
            hasActive: false,
            mode: Math.round(filterMode) || 0,
            cutoffHz: Number(filterCutoff) || 1000,
            q: Number(filterQ) || 0.707107,
        };
    }

    return observedState ?? {
        voiceGeneration: -1,
        hasActive: false,
        mode: Math.round(filterMode) || 0,
        cutoffHz: Number(filterCutoff) || 1000,
        q: Number(filterQ) || 0.707107,
    };
}

export function useObservedFilterSpectrum(active = true) {
    const message = usePatchVisualEndpoint<unknown | null>(FILTER_SPECTRUM_ENDPOINT_ID, null, active);
    const [observedState, setObservedState] = useState<FilterSpectrumFrame | null>(null);

    useEffect(() => {
        if (!active) {
            setObservedState(null);
            return;
        }
        if (!message) {
            return;
        }

        const normalizedState = normalizeFilterSpectrumMessage(message);
        if (!normalizedState) {
            return;
        }

        setObservedState(normalizedState);
    }, [active, message]);

    return observedState;
}

export function useObservedDistortionScope(active = true) {
    const message = usePatchVisualEndpoint<unknown | null>(DISTORTION_SCOPE_ENDPOINT_ID, null, active);
    const [observedState, setObservedState] = useState<DistortionScopeFrame | null>(null);

    useEffect(() => {
        if (!active) {
            setObservedState(null);
            return;
        }
        if (!message) {
            return;
        }

        const normalizedState = normalizeDistortionScopeMessage(message);
        if (!normalizedState) {
            return;
        }

        setObservedState(normalizedState);
    }, [active, message]);

    return observedState;
}

export function useObservedDistortionHistory(active = true) {
    const message = usePatchVisualEndpoint<unknown | null>(DISTORTION_HISTORY_ENDPOINT_ID, null, active);
    const [observedState, setObservedState] = useState<DistortionHistoryFrame | null>(null);

    useEffect(() => {
        if (!active) {
            setObservedState(null);
            return;
        }
        if (!message) {
            return;
        }

        const normalizedState = normalizeDistortionHistoryMessage(message);
        if (!normalizedState) {
            return;
        }

        setObservedState(normalizedState);
    }, [active, message]);

    return observedState;
}

export function useObservedMsegState(active = true) {
    const message = usePatchVisualEndpoint<unknown | null>(EFFECTIVE_MSEG_STATE_ENDPOINT_ID, null, active);
    const [observedState, setObservedState] = useState<EffectiveMsegState | null>(null);

    useEffect(() => {
        if (!active) {
            setObservedState(null);
            return;
        }
        if (!message) {
            return;
        }

        if (!normalizeEffectiveMsegStateMessage(message)) {
            return;
        }

        setObservedState((previousState) => selectObservedEffectiveMsegState(previousState, message));
    }, [active, message]);

    return observedState;
}

export function useObservedWarpState({
    warpMode,
    warpAmount,
}: {
    warpMode: number;
    warpAmount: number;
}) {
    const message = usePatchVisualEndpoint<unknown | null>(EFFECTIVE_WARP_STATE_ENDPOINT_ID, null);
    const [observedState, setObservedState] = useState<EffectiveWarpState>(() => ({
        voiceGeneration: -1,
        hasActive: false,
        mode: Math.round(warpMode) || 0,
        amount: Number(warpAmount) || 0,
    }));

    useEffect(() => {
        setObservedState((previousState) => selectObservedEffectiveWarpState(previousState, message));
    }, [message]);

    useEffect(() => {
        if (message) {
            return;
        }

        setObservedState({
            voiceGeneration: -1,
            hasActive: false,
            mode: Math.round(warpMode) || 0,
            amount: Number(warpAmount) || 0,
        });
    }, [message, warpAmount, warpMode]);

    if (!message) {
        return {
            voiceGeneration: -1,
            hasActive: false,
            mode: Math.round(warpMode) || 0,
            amount: Number(warpAmount) || 0,
        };
    }

    return observedState ?? {
        voiceGeneration: -1,
        hasActive: false,
        mode: Math.round(warpMode) || 0,
        amount: Number(warpAmount) || 0,
    };
}

export function useObservedUnisonState({
    unisonVoices,
    unisonDetune,
    unisonBlend,
    unisonWidth,
    unisonDetuneMode,
    unisonStackMode,
    unisonWavetablePositionSpread,
    unisonWarpSpread,
}: {
    unisonVoices: number;
    unisonDetune: number;
    unisonBlend: number;
    unisonWidth: number;
    unisonDetuneMode: number;
    unisonStackMode: number;
    unisonWavetablePositionSpread: number;
    unisonWarpSpread: number;
}) {
    const message = usePatchVisualEndpoint<unknown | null>(EFFECTIVE_UNISON_STATE_ENDPOINT_ID, null);
    const fallbackState = useMemo<EffectiveUnisonState>(() => ({
        voiceGeneration: -1,
        hasActive: false,
        voices: clamp(Math.round(Number(unisonVoices) || 1), 1, 8),
        detune: clamp(Number(unisonDetune) || 0, 0, 1),
        blend: clamp(Number(unisonBlend) || 0, 0, 1),
        width: clamp(Number(unisonWidth) || 0, 0, 1),
        detuneMode: clamp(Math.round(Number(unisonDetuneMode) || 0), 0, 4),
        stackMode: clamp(Math.round(Number(unisonStackMode) || 0), 0, 4),
        wavetablePositionSpread: clamp(Number(unisonWavetablePositionSpread) || 0, 0, 1),
        warpSpread: clamp(Number(unisonWarpSpread) || 0, 0, 1),
    }), [
        unisonBlend,
        unisonDetune,
        unisonDetuneMode,
        unisonStackMode,
        unisonVoices,
        unisonWarpSpread,
        unisonWavetablePositionSpread,
        unisonWidth,
    ]);
    const [observedState, setObservedState] = useState<EffectiveUnisonState>(() => fallbackState);

    useEffect(() => {
        setObservedState((previousState) => selectObservedEffectiveUnisonState(previousState, message));
    }, [message]);

    useEffect(() => {
        if (message) {
            return;
        }

        setObservedState(fallbackState);
    }, [fallbackState, message]);

    return message ? observedState : fallbackState;
}

const modulationAmountRenderIdleMilliseconds = 50;

export function useModulationState() {
    const patchConnection = usePatchConnection();
    const [state, setState] = useState<ModulationState | null>(null);
    const bridgeRef = useRef<ReturnType<typeof acquireModulationRuntimeBridge> | null>(null);

    useEffect(() => {
        const bridge = acquireModulationRuntimeBridge(patchConnection);
        let pendingAmountState: ModulationState | null = null;
        let pendingAmountTimer: ReturnType<typeof setTimeout> | null = null;
        const clearPendingAmountState = () => {
            if (pendingAmountTimer !== null) {
                clearTimeout(pendingAmountTimer);
                pendingAmountTimer = null;
            }
            pendingAmountState = null;
        };
        const handleStateChange = (
            nextState: ModulationState,
            changeKind: ModulationStateChangeKind,
        ) => {
            if (changeKind === "routeAmount") {
                pendingAmountState = nextState;
                if (pendingAmountTimer !== null) {
                    clearTimeout(pendingAmountTimer);
                }
                pendingAmountTimer = setTimeout(() => {
                    pendingAmountTimer = null;
                    const latestState = pendingAmountState;
                    pendingAmountState = null;
                    if (latestState) {
                        setState(latestState);
                    }
                }, modulationAmountRenderIdleMilliseconds);
                return;
            }

            clearPendingAmountState();
            setState(nextState);
        };
        bridgeRef.current = bridge;
        setState(bridge.getState());
        bridge.subscribe(handleStateChange);

        return () => {
            clearPendingAmountState();
            bridge.unsubscribe(handleStateChange);
            releaseModulationRuntimeBridge(patchConnection);
            bridgeRef.current = null;
        };
    }, [patchConnection]);

    return {
        state,
        bridge: bridgeRef,
    };
}

function buildShortMidi(status: number, noteNumber: number, velocity = 0) {
    return ((status & 0xff) << 16) | ((noteNumber & 0x7f) << 8) | (velocity & 0x7f);
}

function readFullStoredStateValue(storedState: unknown, key: string) {
    const fullState = storedState && typeof storedState === "object"
        ? storedState as Record<string, unknown>
        : {};
    const values = fullState.values && typeof fullState.values === "object"
        ? fullState.values as Record<string, unknown>
        : {};

    if (Object.prototype.hasOwnProperty.call(values, key)) {
        return values[key];
    }

    if (Object.prototype.hasOwnProperty.call(fullState, key)) {
        return fullState[key];
    }

    return undefined;
}

function currentArticulationRouteIds(routes: ReadonlyArray<ModulationRoute>): ReadonlySet<string> {
    return new Set(routes.flatMap((route) => (
        getModulationArticulationCellIndex(route) === null ? [] : [route.id]
    )));
}

function decodeArticulationDocument(rawValue: unknown): unknown {
    if (typeof rawValue !== "string") {
        return rawValue;
    }
    try {
        return JSON.parse(rawValue);
    } catch {
        return rawValue;
    }
}

/**
 * Parse articulation state against modulation routes from the same full-state
 * snapshot, so callback timing cannot manufacture phantom-route rejection.
 */
export function parseArticulationStateFromFullStoredState(
    storedState: unknown,
    fallbackRoutes: ReadonlyArray<ModulationRoute>,
) {
    const rawModulation = readFullStoredStateValue(storedState, MODULATION_STATE_KEY);
    const parsedModulation = rawModulation === undefined
        ? null
        : parseModulationState(decodeArticulationDocument(rawModulation));
    const acceptedRouteIds = parsedModulation?._tag === "ok"
        ? currentArticulationRouteIds(parsedModulation.value.routes)
        : currentArticulationRouteIds(fallbackRoutes);
    const rawArticulations = readFullStoredStateValue(storedState, ARTICULATIONS_V4_STATE_KEY);

    return {
        acceptedRouteIds,
        parsedState: rawArticulations === undefined
            ? null
            : parseArticulationsV4(decodeArticulationDocument(rawArticulations), acceptedRouteIds),
    };
}

function readArticulationOverride(
    slot: ArticulationSlotV4,
    parameterId: ArticulationVoiceParameterId,
    fallback: number,
): number {
    const value = slot.overrides[parameterId];
    return value === undefined ? fallback : value;
}

type EnvelopeArticulationParameterIds = {
    readonly attackSeconds: ArticulationVoiceParameterId;
    readonly decaySeconds: ArticulationVoiceParameterId;
    readonly sustain: ArticulationVoiceParameterId;
    readonly releaseSeconds: ArticulationVoiceParameterId;
};

const ENVELOPE_ARTICULATION_PARAMETER_IDS: readonly [
    EnvelopeArticulationParameterIds,
    EnvelopeArticulationParameterIds,
    EnvelopeArticulationParameterIds,
] = [
    {
        attackSeconds: "env1.attackSeconds",
        decaySeconds: "env1.decaySeconds",
        sustain: "env1.sustain",
        releaseSeconds: "env1.releaseSeconds",
    },
    {
        attackSeconds: "env2.attackSeconds",
        decaySeconds: "env2.decaySeconds",
        sustain: "env2.sustain",
        releaseSeconds: "env2.releaseSeconds",
    },
    {
        attackSeconds: "env3.attackSeconds",
        decaySeconds: "env3.decaySeconds",
        sustain: "env3.sustain",
        releaseSeconds: "env3.releaseSeconds",
    },
];

function resolveEditorEnvelope(
    slot: ArticulationSlotV4,
    envelope: ModulationEnvelope,
    parameterIds: EnvelopeArticulationParameterIds,
): ModulationEnvelope {
    return {
        ...envelope,
        attackSeconds: readArticulationOverride(slot, parameterIds.attackSeconds, envelope.attackSeconds),
        decaySeconds: readArticulationOverride(slot, parameterIds.decaySeconds, envelope.decaySeconds),
        sustain: readArticulationOverride(slot, parameterIds.sustain, envelope.sustain),
        releaseSeconds: readArticulationOverride(slot, parameterIds.releaseSeconds, envelope.releaseSeconds),
    };
}

function selectedOscillatorArticulationID(
    oscillatorID: OscillatorID,
    parameterID: OscillatorArticulationParameterId,
): ArticulationVoiceParameterId {
    return `osc${oscillatorID}.${parameterID}`;
}

/** Resolve the selected oscillator and shared editor view over one stable patch base. */
export function resolveVisibleArticulationSnapshotV4(
    slot: ArticulationSlotV4,
    baseSnapshot: ArticulationSnapshot,
    routes: ReadonlyArray<ModulationRoute>,
    oscillatorID: OscillatorID,
): ArticulationSnapshot {
    const base = normalizeArticulationSnapshot(baseSnapshot);
    const parameters = base.parameters;
    const baseRouteAmounts = new Map(
        base.modRouteAmounts.map(({ routeId, amount }) => [routeId, amount]),
    );
    const routeAmounts = routes.flatMap((route) => {
        if (getModulationArticulationCellIndex(route) === null) {
            return [];
        }
        const amount = slot.routeAmounts[route.id]
            ?? baseRouteAmounts.get(route.id)
            ?? route.amount;
        return [{ routeId: route.id, amount }];
    });

    return normalizeArticulationSnapshot({
        parameters: {
            ...parameters,
            wavetablePosition: readArticulationOverride(slot, selectedOscillatorArticulationID(oscillatorID, "framePosition"), parameters.wavetablePosition),
            pan: readArticulationOverride(slot, selectedOscillatorArticulationID(oscillatorID, "pan"), parameters.pan),
            octave: readArticulationOverride(slot, selectedOscillatorArticulationID(oscillatorID, "octave"), parameters.octave),
            semitone: readArticulationOverride(slot, selectedOscillatorArticulationID(oscillatorID, "semitone"), parameters.semitone),
            fineCents: readArticulationOverride(slot, selectedOscillatorArticulationID(oscillatorID, "fineCents"), parameters.fineCents),
            volumeDb: readArticulationOverride(slot, selectedOscillatorArticulationID(oscillatorID, "volumeDb"), parameters.volumeDb),
            mute: readArticulationOverride(slot, selectedOscillatorArticulationID(oscillatorID, "mute"), parameters.mute),
            solo: readArticulationOverride(slot, selectedOscillatorArticulationID(oscillatorID, "solo"), parameters.solo),
            warpMode: readArticulationOverride(slot, selectedOscillatorArticulationID(oscillatorID, "warpMode"), parameters.warpMode),
            warpAmount: readArticulationOverride(slot, selectedOscillatorArticulationID(oscillatorID, "warpAmount"), parameters.warpAmount),
            filterMode: readArticulationOverride(slot, "filterMode", parameters.filterMode),
            filterCutoff: readArticulationOverride(slot, "filterCutoffHz", parameters.filterCutoff),
            filterQ: readArticulationOverride(slot, "filterQ", parameters.filterQ),
            unisonVoices: readArticulationOverride(slot, selectedOscillatorArticulationID(oscillatorID, "unisonVoices"), parameters.unisonVoices),
            unisonDetune: readArticulationOverride(slot, selectedOscillatorArticulationID(oscillatorID, "unisonDetune"), parameters.unisonDetune),
            unisonBlend: readArticulationOverride(slot, selectedOscillatorArticulationID(oscillatorID, "unisonBlend"), parameters.unisonBlend),
            unisonWidth: readArticulationOverride(slot, selectedOscillatorArticulationID(oscillatorID, "unisonWidth"), parameters.unisonWidth),
            unisonPhase: readArticulationOverride(slot, selectedOscillatorArticulationID(oscillatorID, "phase"), parameters.unisonPhase),
            unisonRandom: readArticulationOverride(slot, selectedOscillatorArticulationID(oscillatorID, "phaseRandom"), parameters.unisonRandom),
            unisonPhaseMode: readArticulationOverride(slot, selectedOscillatorArticulationID(oscillatorID, "retrigger"), parameters.unisonPhaseMode),
            unisonDetuneMode: readArticulationOverride(slot, selectedOscillatorArticulationID(oscillatorID, "unisonDetuneMode"), parameters.unisonDetuneMode),
            unisonStackMode: readArticulationOverride(slot, selectedOscillatorArticulationID(oscillatorID, "unisonStackMode"), parameters.unisonStackMode),
            unisonWavetablePositionSpread: readArticulationOverride(
                slot,
                selectedOscillatorArticulationID(oscillatorID, "unisonWavetablePositionSpread"),
                parameters.unisonWavetablePositionSpread,
            ),
            unisonWarpSpread: readArticulationOverride(slot, selectedOscillatorArticulationID(oscillatorID, "unisonWarpSpread"), parameters.unisonWarpSpread),
            msegMorphs: [
                readArticulationOverride(slot, "msegMorph1", parameters.msegMorphs[0]),
                readArticulationOverride(slot, "msegMorph2", parameters.msegMorphs[1]),
                readArticulationOverride(slot, "msegMorph3", parameters.msegMorphs[2]),
            ],
        },
        envelopes: [0, 1, 2].map((index) => resolveEditorEnvelope(
            slot,
            base.envelopes[index] ?? createDefaultEnvelope(index),
            ENVELOPE_ARTICULATION_PARAMETER_IDS[index] ?? ENVELOPE_ARTICULATION_PARAMETER_IDS[0],
        )),
        modRouteAmounts: routeAmounts,
    });
}

function projectCurrentArticulationsToEditorBank(
    state: ArticulationsState,
    baseSnapshot: ArticulationSnapshot,
    routes: ReadonlyArray<ModulationRoute>,
    oscillatorID: OscillatorID,
): ArticulationEditorState {
    return normalizeArticulationEditorState({
        selectedSlotId: state.selectedSlotId,
        activeTriggerMode: state.activeTriggerMode,
        slots: state.slots.map((slot) => ({
            id: slot.id,
            runtimeSlot: slot.runtimeSlot,
            name: slot.name,
            snapshot: resolveVisibleArticulationSnapshotV4(slot, baseSnapshot, routes, oscillatorID),
        })),
        keyAssignments: state.slots.map((slot) => ({ articulationId: slot.id, note: slot.key })),
        velocityAssignments: state.slots.map((slot) => ({
            id: `velocity-${slot.id}`,
            articulationId: slot.id,
            ...slot.velRange,
        })),
        chainAssignments: state.slots.map((slot) => ({
            id: `chain-${slot.id}`,
            articulationId: slot.id,
            ...slot.chainRange,
        })),
    });
}

const VISIBLE_SHARED_ARTICULATION_PARAMETER_IDS: ReadonlyArray<ArticulationVoiceParameterId> = [
    "filterMode",
    "filterCutoffHz",
    "filterQ",
    "msegMorph1",
    "msegMorph2",
    "msegMorph3",
    "env1.attackSeconds",
    "env1.decaySeconds",
    "env1.sustain",
    "env1.releaseSeconds",
    "env2.attackSeconds",
    "env2.decaySeconds",
    "env2.sustain",
    "env2.releaseSeconds",
    "env3.attackSeconds",
    "env3.decaySeconds",
    "env3.sustain",
    "env3.releaseSeconds",
];

function visibleArticulationParameterIDs(
    oscillatorID: OscillatorID,
): ReadonlySet<ArticulationVoiceParameterId> {
    return new Set([
        ...getOscillatorBindingContract(oscillatorID).articulationParameterIDs,
        ...VISIBLE_SHARED_ARTICULATION_PARAMETER_IDS,
    ]);
}

/** Project the selected oscillator and shared snapshot surface into its v4 keys. */
export function projectArticulationSnapshotToVisibleV4Layer(
    snapshotValue: ArticulationSnapshot,
    oscillatorID: OscillatorID,
): CapturedArticulationLayer {
    const snapshot = normalizeArticulationSnapshot(snapshotValue);
    const parameters = snapshot.parameters;
    const envelope1 = snapshot.envelopes[0] ?? createDefaultEnvelope(0);
    const envelope2 = snapshot.envelopes[1] ?? createDefaultEnvelope(1);
    const envelope3 = snapshot.envelopes[2] ?? createDefaultEnvelope(2);
    return {
        overrides: {
            [selectedOscillatorArticulationID(oscillatorID, "framePosition")]: parameters.wavetablePosition,
            [selectedOscillatorArticulationID(oscillatorID, "pan")]: parameters.pan,
            [selectedOscillatorArticulationID(oscillatorID, "octave")]: parameters.octave,
            [selectedOscillatorArticulationID(oscillatorID, "semitone")]: parameters.semitone,
            [selectedOscillatorArticulationID(oscillatorID, "fineCents")]: parameters.fineCents,
            [selectedOscillatorArticulationID(oscillatorID, "volumeDb")]: parameters.volumeDb,
            [selectedOscillatorArticulationID(oscillatorID, "mute")]: parameters.mute,
            [selectedOscillatorArticulationID(oscillatorID, "solo")]: parameters.solo,
            [selectedOscillatorArticulationID(oscillatorID, "phase")]: parameters.unisonPhase,
            [selectedOscillatorArticulationID(oscillatorID, "phaseRandom")]: parameters.unisonRandom,
            [selectedOscillatorArticulationID(oscillatorID, "retrigger")]: parameters.unisonPhaseMode,
            [selectedOscillatorArticulationID(oscillatorID, "warpMode")]: parameters.warpMode,
            [selectedOscillatorArticulationID(oscillatorID, "warpAmount")]: parameters.warpAmount,
            filterMode: parameters.filterMode,
            filterCutoffHz: parameters.filterCutoff,
            filterQ: parameters.filterQ,
            [selectedOscillatorArticulationID(oscillatorID, "unisonVoices")]: parameters.unisonVoices,
            [selectedOscillatorArticulationID(oscillatorID, "unisonDetune")]: parameters.unisonDetune,
            [selectedOscillatorArticulationID(oscillatorID, "unisonBlend")]: parameters.unisonBlend,
            [selectedOscillatorArticulationID(oscillatorID, "unisonWidth")]: parameters.unisonWidth,
            [selectedOscillatorArticulationID(oscillatorID, "unisonDetuneMode")]: parameters.unisonDetuneMode,
            [selectedOscillatorArticulationID(oscillatorID, "unisonStackMode")]: parameters.unisonStackMode,
            [selectedOscillatorArticulationID(oscillatorID, "unisonWavetablePositionSpread")]: parameters.unisonWavetablePositionSpread,
            [selectedOscillatorArticulationID(oscillatorID, "unisonWarpSpread")]: parameters.unisonWarpSpread,
            msegMorph1: parameters.msegMorphs[0],
            msegMorph2: parameters.msegMorphs[1],
            msegMorph3: parameters.msegMorphs[2],
            "env1.attackSeconds": envelope1.attackSeconds,
            "env1.decaySeconds": envelope1.decaySeconds,
            "env1.sustain": envelope1.sustain,
            "env1.releaseSeconds": envelope1.releaseSeconds,
            "env2.attackSeconds": envelope2.attackSeconds,
            "env2.decaySeconds": envelope2.decaySeconds,
            "env2.sustain": envelope2.sustain,
            "env2.releaseSeconds": envelope2.releaseSeconds,
            "env3.attackSeconds": envelope3.attackSeconds,
            "env3.decaySeconds": envelope3.decaySeconds,
            "env3.sustain": envelope3.sustain,
            "env3.releaseSeconds": envelope3.releaseSeconds,
        },
        routeAmounts: Object.fromEntries(
            snapshot.modRouteAmounts.map(({ routeId, amount }) => [routeId, amount]),
        ),
    };
}

/**
 * Capture the part of one slot owned by the selected oscillator/shared editor without
 * materializing inherited values or replacing fields that editor cannot see.
 */
export function replaceVisibleArticulationSnapshotV4(
    state: ArticulationsState,
    slotId: string,
    currentSnapshot: ArticulationSnapshot,
    baseSnapshot: ArticulationSnapshot,
    routes: ReadonlyArray<ModulationRoute>,
    oscillatorID: OscillatorID,
): ArticulationsState {
    const layer = diffCapturedArticulationLayerV4(
        projectArticulationSnapshotToVisibleV4Layer(currentSnapshot, oscillatorID),
        projectArticulationSnapshotToVisibleV4Layer(baseSnapshot, oscillatorID),
    );
    return replaceVisibleArticulationLayerV4(
        state,
        slotId,
        layer,
        visibleArticulationParameterIDs(oscillatorID),
        currentArticulationRouteIds(routes),
    );
}

function articulationStatesEqual(left: ArticulationsState, right: ArticulationsState): boolean {
    return JSON.stringify(serializeArticulationsV4(left)) === JSON.stringify(serializeArticulationsV4(right));
}

function useStoredArticulationEditorState(
    modulationBridge: RefObject<ReturnType<typeof acquireModulationRuntimeBridge> | null>,
    modulationState: ModulationState | null,
    getBaseSnapshot: () => ArticulationSnapshot,
    oscillatorID: OscillatorID,
) {
    const patchConnection = usePatchConnection();
    const emptyState = createEmptyArticulationsState();
    const [state, setState] = useState<ArticulationsState>(emptyState);
    const [bank, setBank] = useState<ArticulationEditorState>(() => createDefaultArticulationEditorState());
    const [hasHydrated, setHasHydrated] = useState(false);
    const stateRef = useRef(state);
    const bankRef = useRef(bank);
    const modulationStateRef = useRef(modulationState);
    const acceptedRouteIdsRef = useRef<ReadonlySet<string>>(new Set());
    const getBaseSnapshotRef = useRef(getBaseSnapshot);
    const pendingEchoTokensRef = useRef(new Map<string, number>());

    getBaseSnapshotRef.current = getBaseSnapshot;
    modulationStateRef.current = modulationState;
    if (modulationState !== null) {
        acceptedRouteIdsRef.current = currentArticulationRouteIds(modulationState.routes);
    }

    const rememberPendingEcho = useCallback((serializedBank: string) => {
        const pendingEchoTokens = pendingEchoTokensRef.current;
        pendingEchoTokens.set(serializedBank, (pendingEchoTokens.get(serializedBank) ?? 0) + 1);
    }, []);

    const consumePendingEcho = useCallback((serializedBank: string) => {
        const pendingEchoTokens = pendingEchoTokensRef.current;
        const pendingCount = pendingEchoTokens.get(serializedBank) ?? 0;
        if (pendingCount <= 0) return false;
        if (pendingCount === 1) pendingEchoTokens.delete(serializedBank);
        else pendingEchoTokens.set(serializedBank, pendingCount - 1);
        return true;
    }, []);

    const applyCurrentState = useCallback((nextState: ArticulationsState) => {
        const routes = modulationBridge.current?.getState().routes ?? modulationStateRef.current?.routes ?? [];
        const nextBank = projectCurrentArticulationsToEditorBank(
            nextState,
            getBaseSnapshotRef.current(),
            routes,
            oscillatorID,
        );
        stateRef.current = nextState;
        bankRef.current = nextBank;
        setState((previousState) => articulationStatesEqual(previousState, nextState) ? previousState : nextState);
        setBank((previousBank) => (
            articulationEditorStatesEqual(previousBank, nextBank) ? previousBank : nextBank
        ));
    }, [modulationBridge, oscillatorID, patchConnection]);

    const applyIncomingState = useCallback((
        rawValue: unknown,
        isHydration: boolean,
        acceptedRouteIds: ReadonlySet<string> = acceptedRouteIdsRef.current,
    ) => {
        if (rawValue === undefined) {
            if (isHydration) {
                acceptedRouteIdsRef.current = acceptedRouteIds;
                setHasHydrated(true);
                applyCurrentState(createEmptyArticulationsState());
            }
            return;
        }

        const parsedState = parseArticulationsV4(decodeArticulationDocument(rawValue), acceptedRouteIds);
        if (parsedState._tag === "err") {
            if (isHydration) setHasHydrated(true);
            return;
        }

        const serializedState = JSON.stringify(serializeArticulationsV4(parsedState.value));
        if (consumePendingEcho(serializedState)) return;
        acceptedRouteIdsRef.current = acceptedRouteIds;
        setHasHydrated(true);
        applyCurrentState(parsedState.value);
    }, [applyCurrentState, consumePendingEcho]);

    useEffect(() => {
        const handleStoredStateValue = (message: unknown) => {
            if (!message || typeof message !== "object") return;
            const nextMessage = message as { key?: unknown; value?: unknown };
            if (nextMessage.key !== ARTICULATIONS_V4_STATE_KEY) return;
            applyIncomingState(nextMessage.value, false);
        };

        patchConnection.addStoredStateValueListener?.(handleStoredStateValue);
        if (typeof patchConnection.requestFullStoredState === "function") {
            patchConnection.requestFullStoredState((storedState) => {
                const parsedSnapshot = parseArticulationStateFromFullStoredState(
                    storedState,
                    modulationBridge.current?.getState().routes ?? modulationStateRef.current?.routes ?? [],
                );
                acceptedRouteIdsRef.current = parsedSnapshot.acceptedRouteIds;
                if (parsedSnapshot.parsedState === null) {
                    applyIncomingState(undefined, true, parsedSnapshot.acceptedRouteIds);
                    return;
                }
                if (parsedSnapshot.parsedState._tag === "err") {
                    setHasHydrated(true);
                    return;
                }
                applyIncomingState(
                    serializeArticulationsV4(parsedSnapshot.parsedState.value),
                    true,
                    parsedSnapshot.acceptedRouteIds,
                );
            });
        } else if (typeof patchConnection.requestStoredStateValue === "function") {
            patchConnection.requestStoredStateValue(ARTICULATIONS_V4_STATE_KEY);
        } else {
            applyIncomingState(undefined, true);
        }

        return () => patchConnection.removeStoredStateValueListener?.(handleStoredStateValue);
    }, [applyIncomingState, patchConnection]);

    const setAndPersistState = useCallback((
        nextStateValue: ArticulationsState | ((previousState: ArticulationsState) => ArticulationsState),
        acceptedRouteIds: ReadonlySet<string> = acceptedRouteIdsRef.current,
        refreshProjection = false,
    ) => {
        const previousState = stateRef.current;
        const candidate = typeof nextStateValue === "function"
            ? nextStateValue(previousState)
            : nextStateValue;
        const parsedState = parseArticulationsV4(
            serializeArticulationsV4(candidate),
            acceptedRouteIds,
        );
        if (parsedState._tag === "err") return;

        if (articulationStatesEqual(previousState, parsedState.value)) {
            if (refreshProjection) {
                acceptedRouteIdsRef.current = acceptedRouteIds;
                applyCurrentState(parsedState.value);
            }
            return;
        }

        const nextState = parsedState.value;
        const serializedState = JSON.stringify(serializeArticulationsV4(nextState));
        acceptedRouteIdsRef.current = acceptedRouteIds;
        applyCurrentState(nextState);
        setHasHydrated(true);
        if (typeof patchConnection.sendStoredStateValue === "function") {
            rememberPendingEcho(serializedState);
            patchConnection.sendStoredStateValue(ARTICULATIONS_V4_STATE_KEY, serializedState);
        }
    }, [applyCurrentState, patchConnection, rememberPendingEcho]);

    return useMemo(() => ({
        state,
        stateRef,
        bank,
        bankRef,
        hasHydrated,
        setAndPersistState,
    }), [bank, hasHydrated, setAndPersistState, state]);
}

function parsePresetStoredStateValue(rawValue: unknown, label: string) {
    if (typeof rawValue !== "string") {
        return rawValue;
    }

    try {
        return JSON.parse(rawValue);
    } catch (error) {
        throw new Error(`${label} must be valid JSON.`);
    }
}

function parseStrictArticulationPresetState(
    rawValue: unknown,
    acceptedRouteIds: ReadonlySet<string>,
): ArticulationsState {
    const parsedValue = parsePresetStoredStateValue(rawValue, "Articulation preset state");
    const parsedState = parseArticulationsV4(parsedValue, acceptedRouteIds);
    if (parsedState._tag === "err") {
        throw parsedState.error;
    }

    return parsedState.value;
}

function parseStrictModulationPresetState(rawValue: unknown): ModulationState {
    const parsedValue = parsePresetStoredStateValue(rawValue, "Modulation preset state");
    const parsedState = parseModulationState(parsedValue);
    if (parsedState._tag === "err") {
        throw parsedState.error;
    }

    return parsedState.value;
}

function presetParameterNumber(
    context: EffectStoredStateContext,
    endpointID: string,
    fallback: number,
) {
    const value = context.parameters[endpointID];
    return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

/** Build one oscillator's stable local/shared patch base from the preset transaction itself. */
export function buildPresetArticulationBaseSnapshot(
    context: EffectStoredStateContext,
    modulationState: ModulationState,
    oscillatorID: OscillatorID,
): ArticulationSnapshot {
    const defaults = createDefaultArticulationSnapshot();
    const parameters = defaults.parameters;
    return normalizeArticulationSnapshot({
        parameters: {
            wavetablePosition: presetParameterNumber(
                context,
                getOscillatorControlAddress(oscillatorID, "framePosition").endpointID,
                parameters.wavetablePosition,
            ),
            pan: presetParameterNumber(context, getOscillatorControlAddress(oscillatorID, "pan").endpointID, parameters.pan),
            octave: presetParameterNumber(context, getOscillatorControlAddress(oscillatorID, "octave").endpointID, parameters.octave),
            semitone: presetParameterNumber(context, getOscillatorControlAddress(oscillatorID, "semitone").endpointID, parameters.semitone),
            fineCents: presetParameterNumber(context, getOscillatorControlAddress(oscillatorID, "fineCents").endpointID, parameters.fineCents),
            volumeDb: presetParameterNumber(context, getOscillatorControlAddress(oscillatorID, "volumeDb").endpointID, parameters.volumeDb),
            mute: presetParameterNumber(context, getOscillatorControlAddress(oscillatorID, "mute").endpointID, parameters.mute),
            solo: presetParameterNumber(context, getOscillatorControlAddress(oscillatorID, "solo").endpointID, parameters.solo),
            warpMode: presetParameterNumber(
                context,
                getOscillatorControlAddress(oscillatorID, "warpMode").endpointID,
                parameters.warpMode,
            ),
            warpAmount: presetParameterNumber(
                context,
                getOscillatorControlAddress(oscillatorID, "warpAmount").endpointID,
                parameters.warpAmount,
            ),
            filterMode: presetParameterNumber(context, FILTER_MODE_ENDPOINT_ID, parameters.filterMode),
            filterCutoff: presetParameterNumber(context, FILTER_CUTOFF_ENDPOINT_ID, parameters.filterCutoff),
            filterQ: presetParameterNumber(context, FILTER_Q_ENDPOINT_ID, parameters.filterQ),
            unisonVoices: presetParameterNumber(
                context,
                getOscillatorControlAddress(oscillatorID, "unisonVoices").endpointID,
                parameters.unisonVoices,
            ),
            unisonDetune: presetParameterNumber(
                context,
                getOscillatorControlAddress(oscillatorID, "unisonDetune").endpointID,
                parameters.unisonDetune,
            ),
            unisonBlend: presetParameterNumber(
                context,
                getOscillatorControlAddress(oscillatorID, "unisonBlend").endpointID,
                parameters.unisonBlend,
            ),
            unisonWidth: presetParameterNumber(
                context,
                getOscillatorControlAddress(oscillatorID, "unisonWidth").endpointID,
                parameters.unisonWidth,
            ),
            unisonPhase: presetParameterNumber(
                context,
                getOscillatorControlAddress(oscillatorID, "phase").endpointID,
                parameters.unisonPhase,
            ),
            unisonRandom: presetParameterNumber(
                context,
                getOscillatorControlAddress(oscillatorID, "phaseRandom").endpointID,
                parameters.unisonRandom,
            ),
            unisonPhaseMode: presetParameterNumber(
                context,
                getOscillatorControlAddress(oscillatorID, "retrigger").endpointID,
                parameters.unisonPhaseMode,
            ),
            unisonDetuneMode: presetParameterNumber(
                context,
                getOscillatorControlAddress(oscillatorID, "unisonDetuneMode").endpointID,
                parameters.unisonDetuneMode,
            ),
            unisonStackMode: presetParameterNumber(
                context,
                getOscillatorControlAddress(oscillatorID, "unisonStackMode").endpointID,
                parameters.unisonStackMode,
            ),
            unisonWavetablePositionSpread: presetParameterNumber(
                context,
                getOscillatorControlAddress(oscillatorID, "unisonWavetablePositionSpread").endpointID,
                parameters.unisonWavetablePositionSpread,
            ),
            unisonWarpSpread: presetParameterNumber(
                context,
                getOscillatorControlAddress(oscillatorID, "unisonWarpSpread").endpointID,
                parameters.unisonWarpSpread,
            ),
            msegMorphs: [
                presetParameterNumber(context, MSEG_1_MORPH_ENDPOINT_ID, parameters.msegMorphs[0]),
                presetParameterNumber(context, MSEG_2_MORPH_ENDPOINT_ID, parameters.msegMorphs[1]),
                presetParameterNumber(context, MSEG_3_MORPH_ENDPOINT_ID, parameters.msegMorphs[2]),
            ],
        },
            envelopes: modulationState.envelopeSlots.map((envelope, slotIndex) => {
                const endpointPrefix = `env${slotIndex + 1}`;
                return {
                    name: envelope.name,
                    attackSeconds: presetParameterNumber(context, `${endpointPrefix}Attack`, 0.01),
                    decaySeconds: presetParameterNumber(context, `${endpointPrefix}Decay`, 0.25),
                    sustain: presetParameterNumber(context, `${endpointPrefix}Sustain`, 0.5),
                    releaseSeconds: presetParameterNumber(context, `${endpointPrefix}Release`, 0.2),
                };
            }),
        modRouteAmounts: modulationState.routes.flatMap((route) => (
            getModulationArticulationCellIndex(route) === null
                ? []
                : [{ routeId: route.id, amount: route.amount }]
        )),
    });
}

function useSynthPresetStoredStateAdapters({
    articulationBankState,
    modulationBridge,
    modulationState,
    setArticulationPatchBase,
}: {
    articulationBankState: ReturnType<typeof useStoredArticulationEditorState>;
    modulationBridge: ReturnType<typeof useModulationState>["bridge"];
    modulationState: ModulationState | null;
    setArticulationPatchBase: (oscillatorID: OscillatorID, snapshot: ArticulationSnapshot) => void;
}) {
    const patchConnection = usePatchConnection();
    const { stateRef, setAndPersistState } = articulationBankState;
    const latestModulationStateRef = useRef<ModulationState | null>(null);

    useEffect(() => {
        latestModulationStateRef.current = modulationState;
    }, [modulationState]);

    return useMemo<EffectStoredStateAdapter[]>(() => {
        const subscribeToStoredStateKey = (stateKey: string, listener: () => void) => {
            const handleStoredStateValue = (message: unknown) => {
                if (!message || typeof message !== "object") {
                    return;
                }

                if ((message as { key?: unknown }).key === stateKey) {
                    listener();
                }
            };

            patchConnection.addStoredStateValueListener?.(handleStoredStateValue);

            return () => {
                patchConnection.removeStoredStateValueListener?.(handleStoredStateValue);
            };
        };

        const presetModulationState = (context?: EffectStoredStateContext) => {
            if (!context || !(MODULATION_STATE_KEY in context.storedState)) {
                throw new Error("Synth preset modulation state is required before articulation validation.");
            }

            return parseStrictModulationPresetState(context.storedState[MODULATION_STATE_KEY]);
        };

        const modulationAdapter: EffectStoredStateAdapter = {
            key: MODULATION_STATE_KEY,
            schemaVersion: MODULATION_STATE_VERSION,
            getContract() {
                return {
                    key: MODULATION_STATE_KEY,
                    schemaVersion: MODULATION_STATE_VERSION,
                    required: true,
                };
            },
            capture() {
                return modulationBridge.current?.getState()
                    ?? latestModulationStateRef.current
                    ?? createDefaultModulationState();
            },
            normalizeForPreset(value: unknown) {
                return parseStrictModulationPresetState(value);
            },
            serializeForPreset(value) {
                return serializeModulationState(parseStrictModulationPresetState(value));
            },
            apply(value) {
                const nextState = parseStrictModulationPresetState(value);

                if (modulationBridge.current) {
                    modulationBridge.current.setState(nextState);
                    return;
                }

                patchConnection.sendStoredStateValue?.(MODULATION_STATE_KEY, serializeModulationState(nextState));
            },
            subscribe(listener: () => void) {
                return subscribeToStoredStateKey(MODULATION_STATE_KEY, listener);
            },
        };
        const articulationAdapter: EffectStoredStateAdapter = {
            key: ARTICULATIONS_V4_STATE_KEY,
            schemaVersion: 4,
            getContract() {
                return {
                    key: ARTICULATIONS_V4_STATE_KEY,
                    schemaVersion: 4,
                    required: true,
                };
            },
            capture() {
                return stateRef.current;
            },
            normalizeForPreset(value: unknown, context?: EffectStoredStateContext) {
                const routeIds = currentArticulationRouteIds(presetModulationState(context).routes);
                return parseStrictArticulationPresetState(value, routeIds);
            },
            serializeForPreset(value, context) {
                const routeIds = currentArticulationRouteIds(presetModulationState(context).routes);
                return serializeArticulationsV4(parseStrictArticulationPresetState(value, routeIds));
            },
            apply(value, context) {
                const nextModulationState = presetModulationState(context);
                const routeIds = currentArticulationRouteIds(nextModulationState.routes);
                if (!context) {
                    throw new Error("Synth preset context is required before articulation application.");
                }
                for (const oscillator of OSCILLATOR_BINDING_CONTRACTS) {
                    setArticulationPatchBase(
                        oscillator.id,
                        buildPresetArticulationBaseSnapshot(context, nextModulationState, oscillator.id),
                    );
                }
                setAndPersistState(parseStrictArticulationPresetState(value, routeIds), routeIds, true);
            },
            subscribe(listener: () => void) {
                return subscribeToStoredStateKey(ARTICULATIONS_V4_STATE_KEY, listener);
            },
        };

        const bounceAdapter = createBouncePresetStoredStateAdapter(patchConnection);
        return [modulationAdapter, articulationAdapter, bounceAdapter];
    }, [modulationBridge, patchConnection, setAndPersistState, setArticulationPatchBase, stateRef]);
}

export function useMsegState() {
    const { state, bridge } = useModulationState();
    const controllerRef = useRef<MsegEditorControllerLike | null>(null);

    controllerRef.current = bridge.current?.getMsegSlotController(0) ?? null;

    return {
        state: state && bridge.current
            ? buildDisplayedMsegState(bridge.current, 0)
            : null,
        controller: controllerRef,
    };
}

export function useStagePositionDrag({
    stageRef,
    observedPosition,
    binding,
}: {
    stageRef: RefObject<HTMLDivElement | null>;
    observedPosition: number;
    binding: PatchControlBinding<number>;
}) {
    const bindingRef = useRef(binding);
    bindingRef.current = binding;
    const activeDisplayDragRef = useRef<{
        pointerId: number;
        startPosition: number;
        startClientY: number;
    } | null>(null);

    const beginPositionGesture = useCallback(() => {
        bindingRef.current.beginGesture();
    }, []);

    const endPositionGesture = useCallback(() => {
        bindingRef.current.endGesture();
    }, []);

    const finishPositionGesture = useCallback((pointerId?: number) => {
        const activeDisplayDrag = activeDisplayDragRef.current;
        if (!activeDisplayDrag || (pointerId !== undefined && activeDisplayDrag.pointerId !== pointerId)) {
            return;
        }

        activeDisplayDragRef.current = null;
        try {
            if (stageRef.current?.hasPointerCapture(activeDisplayDrag.pointerId)) {
                stageRef.current.releasePointerCapture(activeDisplayDrag.pointerId);
            }
        } catch {
            // Capture may already be gone after cancellation, blur, or unmount.
        }
        endPositionGesture();
    }, [endPositionGesture, stageRef]);

    const updatePositionFromPointer = useCallback((event: Pick<
        PointerEvent,
        "pointerId" | "pointerType" | "buttons" | "clientY"
    >) => {
        const activeDisplayDrag = activeDisplayDragRef.current;
        if (!activeDisplayDrag || activeDisplayDrag.pointerId !== event.pointerId || !stageRef.current) {
            return;
        }

        if (event.pointerType === "mouse" && event.buttons === 0) {
            finishPositionGesture(event.pointerId);
            return;
        }

        if (Math.abs(event.clientY - activeDisplayDrag.startClientY) < DISPLAY_SWIPE_THRESHOLD_PX) {
            return;
        }

        const bounds = stageRef.current.getBoundingClientRect();
        const nextPosition = mapDisplayDragToPosition(
            activeDisplayDrag.startPosition,
            activeDisplayDrag.startClientY,
            event.clientY,
            bounds.height,
        );
        bindingRef.current.setValue(nextPosition);
    }, [finishPositionGesture, stageRef]);

    useEffect(() => {
        const handleFallbackPointerMove = (event: PointerEvent) => {
            const activeDisplayDrag = activeDisplayDragRef.current;
            if (!activeDisplayDrag || activeDisplayDrag.pointerId !== event.pointerId) {
                return;
            }
            const stage = stageRef.current;
            if (event.target instanceof Node && stage?.contains(event.target)) {
                return;
            }
            updatePositionFromPointer(event);
        };
        const handlePointerEnd = (event: PointerEvent) => finishPositionGesture(event.pointerId);
        const handleBlur = () => finishPositionGesture();
        const handleVisibilityChange = () => {
            if (document.visibilityState !== "visible") {
                finishPositionGesture();
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
            finishPositionGesture();
        };
    }, [finishPositionGesture, stageRef, updatePositionFromPointer]);

    const handleStagePointerDown = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
        if (event.button !== 0) {
            return;
        }

        if ((event.target as HTMLElement | null)?.closest?.("select, button, input")) {
            return;
        }

        finishPositionGesture();
        beginPositionGesture();
        activeDisplayDragRef.current = {
            pointerId: event.pointerId,
            startPosition: observedPosition,
            startClientY: event.clientY,
        };
        try {
            event.currentTarget.setPointerCapture(event.pointerId);
        } catch {
            // The window-level move fallback keeps owning unsupported pointers.
        }
    }, [beginPositionGesture, finishPositionGesture, observedPosition]);

    const handleStagePointerMove = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
        updatePositionFromPointer(event.nativeEvent);
    }, [updatePositionFromPointer]);

    const handleStagePointerUp = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
        finishPositionGesture(event.pointerId);
    }, [finishPositionGesture]);

    return {
        handleStagePointerDown,
        handleStagePointerMove,
        handleStagePointerUp,
    };
}

export function useMsegEditorInteractions({
    msegState,
    msegController,
    surfaceRef,
    orientation = "horizontal",
    curveEditActivationMode = "immediate",
    curveEditHoldDelayMs = 350,
    onCurveEditHoldActivated = null,
}: {
    msegState: MsegState | null;
    msegController: RefObject<MsegEditorControllerLike | null>;
    surfaceRef: RefObject<SVGSVGElement | null>;
    orientation?: MsegSurfaceOrientation;
    curveEditActivationMode?: "immediate" | "hold-or-drag";
    curveEditHoldDelayMs?: number;
    onCurveEditHoldActivated?: (() => void) | null;
}) {
    const [isOpen, setIsOpen] = useState(false);
    const [selectedPointIndex, setSelectedPointIndex] = useState(0);
    const [hoveredSegmentIndex, setHoveredSegmentIndex] = useState(-1);
    const [activeSegmentIndex, setActiveSegmentIndex] = useState(-1);
    const [undoShape, setUndoShape] = useState<MsegShape | null>(null);
    const activePointerRef = useRef<ActiveMsegPointerState | null>(null);
    const activeGestureUndoCapturedRef = useRef(false);

    const captureUndoShape = useCallback(() => {
        if (activeGestureUndoCapturedRef.current) {
            return;
        }
        const shape = msegController.current?.getState().shape ?? msegState?.shape;
        if (!shape) {
            return;
        }
        setUndoShape({
            ...shape,
            points: shape.points.map((point) => ({ ...point })),
        });
        activeGestureUndoCapturedRef.current = true;
    }, [msegController, msegState?.shape]);

    const clearPendingSegmentTimer = useCallback((pointerState: ActiveMsegPointerState | null) => {
        if (pointerState?.kind === "pending-segment" && pointerState.holdTimeoutId !== null) {
            clearUiTimeout(pointerState.holdTimeoutId);
            pointerState.holdTimeoutId = null;
        }
    }, []);

    const cancelActivePointer = useCallback((pointerId?: number) => {
        const activePointer = activePointerRef.current;
        if (!activePointer || (pointerId !== undefined && activePointer.pointerId !== pointerId)) {
            return;
        }

        activePointerRef.current = null;
        activeGestureUndoCapturedRef.current = false;
        clearPendingSegmentTimer(activePointer);
        try {
            if (surfaceRef.current?.hasPointerCapture(activePointer.pointerId)) {
                surfaceRef.current.releasePointerCapture(activePointer.pointerId);
            }
        } catch {
            // Capture may already be gone after cancellation, blur, or unmount.
        }
        setHoveredSegmentIndex(-1);
        setActiveSegmentIndex(-1);
    }, [clearPendingSegmentTimer, surfaceRef]);

    useEffect(() => {
        if (!msegState) {
            return;
        }

        setSelectedPointIndex((previousIndex) => clamp(
            previousIndex,
            0,
            Math.max(0, msegState.shape.points.length - 1),
        ));
    }, [msegState]);

    const resolvePointerLocation = useCallback((clientX: number, clientY: number) => {
        if (!msegState || !surfaceRef.current) {
            return null;
        }

        const bounds = surfaceRef.current.getBoundingClientRect();
        const localX = clientX - bounds.left;
        const localY = clientY - bounds.top;
        const currentShape = msegController.current?.getState().shape ?? msegState.shape;
        const pointIndex = findMsegPointHitIndex(
            currentShape,
            localX,
            localY,
            bounds.width,
            bounds.height,
            undefined,
            { orientation },
        );
        const segmentIndex = pointIndex >= 0
            ? -1
            : findMsegSegmentHitIndex(
                currentShape,
                localX,
                localY,
                bounds.width,
                bounds.height,
                undefined,
                { orientation },
            );

        return {
            bounds,
            localX,
            localY,
            pointIndex,
            segmentIndex,
        };
    }, [msegController, msegState, orientation, surfaceRef]);

    const updateHoveredSegmentIndex = useCallback((clientX: number, clientY: number) => {
        const pointerLocation = resolvePointerLocation(clientX, clientY);
        setHoveredSegmentIndex(pointerLocation?.segmentIndex ?? -1);
        return pointerLocation;
    }, [resolvePointerLocation]);

    useEffect(() => {
        if (!isOpen) {
            cancelActivePointer();
            return;
        }

        const handleEscapeKey = (event: KeyboardEvent) => {
            if (event.key === "Escape") {
                setIsOpen(false);
            }
        };
        const handleBlur = () => cancelActivePointer();
        const handleVisibilityChange = () => {
            if (document.visibilityState !== "visible") {
                cancelActivePointer();
            }
        };

        window.addEventListener("keydown", handleEscapeKey);
        window.addEventListener("blur", handleBlur);
        document.addEventListener("visibilitychange", handleVisibilityChange);
        return () => {
            window.removeEventListener("keydown", handleEscapeKey);
            window.removeEventListener("blur", handleBlur);
            document.removeEventListener("visibilitychange", handleVisibilityChange);
            cancelActivePointer();
        };
    }, [cancelActivePointer, isOpen]);

    const openEditor = useCallback(() => {
        setUndoShape(null);
        activeGestureUndoCapturedRef.current = false;
        setIsOpen(true);
    }, []);

    const closeEditor = useCallback(() => {
        setIsOpen(false);
        cancelActivePointer();
    }, [cancelActivePointer]);

    const undoLastEdit = useCallback(() => {
        if (!undoShape || !msegController.current) {
            return;
        }
        msegController.current.setShape(undoShape);
        setSelectedPointIndex((previousIndex) => clamp(
            previousIndex,
            0,
            Math.max(0, undoShape.points.length - 1),
        ));
        setUndoShape(null);
        activeGestureUndoCapturedRef.current = false;
    }, [msegController, undoShape]);

    const applyCurveEditFromClientCoordinates = useCallback((segmentIndex: number, clientX: number, clientY: number) => {
        if (!surfaceRef.current || !msegController.current) {
            return;
        }

        const currentShape = msegController.current.getState().shape ?? msegState?.shape;
        if (!currentShape) {
            return;
        }

        const bounds = surfaceRef.current.getBoundingClientRect();
        const point = msegEditorCoordinatesToPoint(
            clientX - bounds.left,
            clientY - bounds.top,
            bounds.width,
            bounds.height,
            { orientation },
        );
        const curvePower = deriveMsegSegmentCurvePower(currentShape, segmentIndex, point.x, point.y);
        captureUndoShape();
        msegController.current.setSegmentCurvePower(segmentIndex, curvePower);
    }, [captureUndoShape, msegController, msegState?.shape, orientation, surfaceRef]);

    const handlePointerDown = useCallback((event: ReactPointerEvent<SVGSVGElement>) => {
        if (event.button !== 0 || !msegState || !surfaceRef.current) {
            return;
        }

        const pointerLocation = updateHoveredSegmentIndex(event.clientX, event.clientY);
        if (!pointerLocation) {
            return;
        }

        if (pointerLocation.pointIndex >= 0) {
            activeGestureUndoCapturedRef.current = false;
            setSelectedPointIndex(pointerLocation.pointIndex);
            setActiveSegmentIndex(-1);
            activePointerRef.current = {
                kind: "point-drag",
                pointerId: event.pointerId,
                pointIndex: pointerLocation.pointIndex,
                startClientX: event.clientX,
                startClientY: event.clientY,
                moved: false,
                deleteOnRelease:
                    pointerLocation.pointIndex > 0 &&
                    pointerLocation.pointIndex < msegState.shape.points.length - 1,
            };
            try {
                event.currentTarget.setPointerCapture(event.pointerId);
            } catch {
                // Window-level termination still owns unsupported or synthetic pointers.
            }
            event.preventDefault();
            return;
        }

        if (pointerLocation.segmentIndex >= 0) {
            activeGestureUndoCapturedRef.current = false;
            setActiveSegmentIndex(pointerLocation.segmentIndex);
            setHoveredSegmentIndex(pointerLocation.segmentIndex);
            if (curveEditActivationMode === "immediate") {
                activePointerRef.current = {
                    kind: "curve-drag",
                    pointerId: event.pointerId,
                    segmentIndex: pointerLocation.segmentIndex,
                };
            } else {
                const holdTimeoutId = uiTimeout(() => {
                    const activePointer = activePointerRef.current;
                    if (
                        !activePointer
                        || activePointer.kind !== "pending-segment"
                        || activePointer.pointerId !== event.pointerId
                    ) {
                        return;
                    }

                    activePointerRef.current = {
                        kind: "curve-drag",
                        pointerId: activePointer.pointerId,
                        segmentIndex: activePointer.segmentIndex,
                    };
                    setActiveSegmentIndex(activePointer.segmentIndex);
                    setHoveredSegmentIndex(activePointer.segmentIndex);
                    onCurveEditHoldActivated?.();
                }, curveEditHoldDelayMs);

                activePointerRef.current = {
                    kind: "pending-segment",
                    pointerId: event.pointerId,
                    segmentIndex: pointerLocation.segmentIndex,
                    startClientX: event.clientX,
                    startClientY: event.clientY,
                    holdTimeoutId,
                };
            }

            try {
                event.currentTarget.setPointerCapture(event.pointerId);
            } catch {
                // Window-level termination still owns unsupported or synthetic pointers.
            }
            event.preventDefault();
            return;
        }

        const point = msegEditorCoordinatesToPoint(
            pointerLocation.localX,
            pointerLocation.localY,
            pointerLocation.bounds.width,
            pointerLocation.bounds.height,
            { orientation },
        );
        activeGestureUndoCapturedRef.current = false;
        captureUndoShape();
        msegController.current?.addPoint(point.x, point.y);
        const points = msegController.current?.getState().shape.points ?? [];
        const nextPointIndex = points.findIndex(
            (nextPoint: { x: number; y: number }) =>
                Math.abs(nextPoint.x - point.x) <= 1e-6 &&
                Math.abs(nextPoint.y - point.y) <= 1e-6,
        );

            if (nextPointIndex >= 0) {
            setSelectedPointIndex(nextPointIndex);
        }

        setActiveSegmentIndex(-1);
        event.preventDefault();
    }, [
        curveEditActivationMode,
        curveEditHoldDelayMs,
        captureUndoShape,
        msegController,
        msegState,
        onCurveEditHoldActivated,
        orientation,
        surfaceRef,
        updateHoveredSegmentIndex,
    ]);

    const handlePointerMove = useCallback((event: ReactPointerEvent<SVGSVGElement>) => {
        const activePointer = activePointerRef.current;
        if (!activePointer || activePointer.pointerId !== event.pointerId || !surfaceRef.current) {
            updateHoveredSegmentIndex(event.clientX, event.clientY);
            return;
        }

        if (activePointer.kind === "curve-drag") {
            applyCurveEditFromClientCoordinates(activePointer.segmentIndex, event.clientX, event.clientY);
            setActiveSegmentIndex(activePointer.segmentIndex);
            setHoveredSegmentIndex(activePointer.segmentIndex);
            event.preventDefault();
            return;
        }

        if (activePointer.kind === "pending-segment") {
            const movementDistance = Math.hypot(
                event.clientX - activePointer.startClientX,
                event.clientY - activePointer.startClientY,
            );

            if (movementDistance < MSEG_DRAG_THRESHOLD_PX) {
                return;
            }

            clearPendingSegmentTimer(activePointer);
            activePointerRef.current = {
                kind: "curve-drag",
                pointerId: activePointer.pointerId,
                segmentIndex: activePointer.segmentIndex,
            };
            setActiveSegmentIndex(activePointer.segmentIndex);
            setHoveredSegmentIndex(activePointer.segmentIndex);
            applyCurveEditFromClientCoordinates(activePointer.segmentIndex, event.clientX, event.clientY);
            event.preventDefault();
            return;
        }

        const movementDistance = Math.hypot(
            event.clientX - activePointer.startClientX,
            event.clientY - activePointer.startClientY,
        );

        if (!activePointer.moved && movementDistance < MSEG_DRAG_THRESHOLD_PX) {
            return;
        }

        const bounds = surfaceRef.current.getBoundingClientRect();
        const point = msegEditorCoordinatesToPoint(
            event.clientX - bounds.left,
            event.clientY - bounds.top,
            bounds.width,
            bounds.height,
            { orientation },
        );
        if (!activePointer.moved) {
            captureUndoShape();
            activePointerRef.current = {
                ...activePointer,
                moved: true,
            };
        }
        msegController.current?.movePoint(activePointer.pointIndex, point.x, point.y);
        setSelectedPointIndex(activePointer.pointIndex);
        setHoveredSegmentIndex(-1);
        setActiveSegmentIndex(-1);
        event.preventDefault();
    }, [
        applyCurveEditFromClientCoordinates,
        captureUndoShape,
        clearPendingSegmentTimer,
        msegController,
        orientation,
        surfaceRef,
        updateHoveredSegmentIndex,
    ]);

    const handlePointerLeave = useCallback((event: ReactPointerEvent<SVGSVGElement>) => {
        if (activePointerRef.current?.pointerId === event.pointerId) {
            return;
        }

        setHoveredSegmentIndex(-1);
    }, []);

    const handlePointerUp = useCallback((event: ReactPointerEvent<SVGSVGElement>) => {
        const activePointer = activePointerRef.current;
        if (!activePointer || activePointer.pointerId !== event.pointerId) {
            return;
        }

        if (event.type !== "pointerup") {
            cancelActivePointer(event.pointerId);
            event.preventDefault();
            return;
        }

        const pointerState = activePointer;
        activePointerRef.current = null;
        setActiveSegmentIndex(-1);
        try {
            if (event.currentTarget.hasPointerCapture(event.pointerId)) {
                event.currentTarget.releasePointerCapture(event.pointerId);
            }
        } catch {
            // Capture may already be gone after a platform cancellation.
        }

        if (pointerState.kind === "pending-segment") {
            clearPendingSegmentTimer(pointerState);
            if (surfaceRef.current) {
                const bounds = surfaceRef.current.getBoundingClientRect();
                const point = msegEditorCoordinatesToPoint(
                    event.clientX - bounds.left,
                    event.clientY - bounds.top,
                    bounds.width,
                    bounds.height,
                    { orientation },
                );
                captureUndoShape();
                msegController.current?.addPoint(point.x, point.y);
                const points = msegController.current?.getState().shape.points ?? [];
                const nextPointIndex = points.findIndex(
                    (nextPoint: { x: number; y: number }) =>
                        Math.abs(nextPoint.x - point.x) <= 1e-6 &&
                        Math.abs(nextPoint.y - point.y) <= 1e-6,
                );

                if (nextPointIndex >= 0) {
                    setSelectedPointIndex(nextPointIndex);
                }
            }
            event.preventDefault();
            setHoveredSegmentIndex(resolvePointerLocation(event.clientX, event.clientY)?.segmentIndex ?? -1);
            return;
        }

        if (pointerState.kind === "curve-drag") {
            setHoveredSegmentIndex(resolvePointerLocation(event.clientX, event.clientY)?.segmentIndex ?? -1);
            event.preventDefault();
            return;
        }

        if (!pointerState.moved && pointerState.deleteOnRelease && msegController.current) {
            captureUndoShape();
            msegController.current.deletePoint(pointerState.pointIndex);
            const pointCount = msegController.current.getState().shape.points.length;
            setSelectedPointIndex(clamp(pointerState.pointIndex - 1, 0, Math.max(0, pointCount - 1)));
        }

        setHoveredSegmentIndex(resolvePointerLocation(event.clientX, event.clientY)?.segmentIndex ?? -1);
        event.preventDefault();
    }, [
        cancelActivePointer,
        captureUndoShape,
        clearPendingSegmentTimer,
        msegController,
        orientation,
        resolvePointerLocation,
        surfaceRef,
    ]);

    return {
        isOpen,
        selectedPointIndex,
        hoveredSegmentIndex,
        activeSegmentIndex,
        canUndo: undoShape !== null,
        openEditor,
        closeEditor,
        undoLastEdit,
        handlePointerDown,
        handlePointerMove,
        handlePointerLeave,
        handlePointerUp,
    };
}

function useStableArrowTarget(targetID: string, onArrowStep: (direction: ArrowStepDirection) => void) {
    const onArrowStepRef = useRef(onArrowStep);

    useEffect(() => {
        onArrowStepRef.current = onArrowStep;
    }, [onArrowStep]);

    return useMemo(() => ({
        id: targetID,
        onArrowStep: (direction: ArrowStepDirection) => {
            onArrowStepRef.current(direction);
        },
    }), [targetID]);
}

export function useSynthKeyboardRouting({
    keyboardRef,
    onStepWavetable,
    onStepPlayMode,
    onStepMsegRate,
    onStepGlideTime,
    onKeyboardOctaveDown,
    onKeyboardOctaveUp,
    keyboardInputMode = "hosted",
    onPreviewNoteOn,
    onPreviewMidiEvent,
    sendMIDIInputEvent,
}: {
    keyboardRef: RefObject<SynthKeyboardLike | null>;
    onStepWavetable: (direction: ArrowStepDirection) => void;
    onStepPlayMode: (direction: ArrowStepDirection) => void;
    onStepMsegRate: (direction: ArrowStepDirection) => void;
    onStepGlideTime: (direction: ArrowStepDirection) => void;
    onKeyboardOctaveDown?: () => boolean;
    onKeyboardOctaveUp?: () => boolean;
    keyboardInputMode?: SynthKeyboardInputMode;
    onPreviewNoteOn?: (noteNumber: number) => void;
    onPreviewMidiEvent?: (status: number, noteNumber: number, velocity: number) => void;
    sendMIDIInputEvent?: (endpointID: string, shortMIDICode: number) => void;
}): SynthKeyboardRoutingBindings {
    const synthInputRouter = useSynthInputRouter(keyboardRef, {
        handleKeyboardOctaveDown: onKeyboardOctaveDown,
        handleKeyboardOctaveUp: onKeyboardOctaveUp,
        keyboardInputMode,
        onPreviewNoteOn,
        onPreviewMidiEvent,
        sendMIDIInputEvent,
    });
    const wavetableTarget = useStableArrowTarget("wavetable-select", onStepWavetable);
    const playModeTarget = useStableArrowTarget("play-mode", onStepPlayMode);
    const msegRateTarget = useStableArrowTarget("mseg-rate", onStepMsegRate);
    const glideTarget = useStableArrowTarget("glide-time", onStepGlideTime);

    return useMemo(() => ({
        wavetableFocusBindings: synthInputRouter.bindArrowTarget(wavetableTarget),
        playModeFocusBindings: synthInputRouter.bindArrowTarget(playModeTarget),
        msegRateFocusBindings: synthInputRouter.bindArrowTarget(msegRateTarget),
        glideFocusTarget: {
            onActivate: () => synthInputRouter.activateArrowTarget(glideTarget),
            onBeginTextEntry: () => synthInputRouter.beginTextEntry(glideTarget),
            onEndTextEntry: () => synthInputRouter.endTextEntry(),
        },
    }), [
        glideTarget,
        msegRateTarget,
        playModeTarget,
        synthInputRouter,
        wavetableTarget,
    ]);
}

export function useSynthPatchViewModel({
    oscillatorID = DEFAULT_SELECTED_OSCILLATOR_ID,
    stageRef,
    msegEditorSurfaceRef,
    keyboardRef,
    voiceModeCount,
    msegSurfaceOrientation = "horizontal",
    msegCurveEditActivationMode = "immediate",
    onMsegCurveEditHoldActivated = null,
    onKeyboardOctaveDown,
    onKeyboardOctaveUp,
    keyboardInputMode = "hosted",
    observeFilterSpectrum = true,
    observeDistortionVisuals = true,
    observeMsegPlayhead = true,
    autoPreviewEnabled = false,
    oscillatorTargetsActive = true,
}: {
    oscillatorID?: OscillatorID;
    stageRef: RefObject<HTMLDivElement | null>;
    msegEditorSurfaceRef: RefObject<SVGSVGElement | null>;
    keyboardRef: RefObject<SynthKeyboardLike | null>;
    voiceModeCount: number;
    msegSurfaceOrientation?: MsegSurfaceOrientation;
    msegCurveEditActivationMode?: "immediate" | "hold-or-drag";
    onMsegCurveEditHoldActivated?: (() => void) | null;
    onKeyboardOctaveDown?: () => boolean;
    onKeyboardOctaveUp?: () => boolean;
    keyboardInputMode?: SynthKeyboardInputMode;
    observeFilterSpectrum?: boolean;
    observeDistortionVisuals?: boolean;
    observeMsegPlayhead?: boolean;
    autoPreviewEnabled?: boolean;
    oscillatorTargetsActive?: boolean;
}): SynthPatchViewModel {
    const patchConnection = usePatchConnection();
    const oscillator = getOscillatorBindingContract(oscillatorID);
    const oscillatorEndpointID = useCallback((controlID: OscillatorControlID) => (
        getOscillatorControlAddress(oscillatorID, controlID).endpointID
    ), [oscillatorID]);
    const runtimeStateMessage = useOscillatorRuntimeTableState(oscillator.oscillatorIndex);
    const normalizedRuntimeState = useMemo(
        () => normalizeRuntimeTableState(runtimeStateMessage),
        [runtimeStateMessage],
    );
    const { catalog, error: catalogError } = useFactoryBankCatalog();
    const wavetablePosition = usePatchParameterBinding<number>({
        endpointID: oscillatorEndpointID("framePosition"),
        initialValue: 0,
        coerce: (value) => clampDisplayPosition(value),
    });
    const wavetableSelect = usePatchParameterBinding<number>({
        endpointID: oscillatorEndpointID("wavetableSelect"),
        initialValue: DEFAULT_FACTORY_TABLE_INDEX,
        coerce: (value) => Math.max(0, Math.trunc(Number(value) || 0)),
    });
    const playMode = usePatchParameterBinding<number>({
        endpointID: PLAY_MODE_ENDPOINT_ID,
        initialValue: 0,
        coerce: (value) => clamp(Math.round(Number(value) || 0), 0, Math.max(0, voiceModeCount - 1)),
    });
    const glideTime = usePatchParameterBinding<number>({
        endpointID: GLIDE_TIME_ENDPOINT_ID,
        initialValue: 0,
        coerce: (value) => clamp(Number(value) || 0, GLIDE_TIME_MIN_SECONDS, GLIDE_TIME_MAX_SECONDS),
    });
    const pan = usePatchParameterBinding<number>({
        endpointID: oscillatorEndpointID("pan"),
        initialValue: 0,
        coerce: (value) => clamp(Number(value) || 0, -1, 1),
    });
    const oscillatorOctave = usePatchParameterBinding<number>({
        endpointID: oscillatorEndpointID("octave"),
        initialValue: 0,
        coerce: (value) => clamp(Math.round(Number(value) || 0), -4, 4),
    });
    const oscillatorSemitone = usePatchParameterBinding<number>({
        endpointID: oscillatorEndpointID("semitone"),
        initialValue: 0,
        coerce: (value) => clamp(Math.round(Number(value) || 0), -12, 12),
    });
    const oscillatorFineCents = usePatchParameterBinding<number>({
        endpointID: oscillatorEndpointID("fineCents"),
        initialValue: 0,
        coerce: (value) => clamp(Number(value) || 0, -100, 100),
    });
    const oscillatorVolumeDb = usePatchParameterBinding<number>({
        endpointID: oscillatorEndpointID("volumeDb"),
        initialValue: -9.542425,
        coerce: (value) => clamp(Number(value) || 0, -48, 6),
    });
    const oscillatorMute = usePatchParameterBinding<number>({
        endpointID: oscillatorEndpointID("mute"),
        initialValue: 0,
        coerce: (value) => clamp(Math.round(Number(value) || 0), 0, 1),
    });
    const oscillatorSolo = usePatchParameterBinding<number>({
        endpointID: oscillatorEndpointID("solo"),
        initialValue: 0,
        coerce: (value) => clamp(Math.round(Number(value) || 0), 0, 1),
    });
    const warpMode = usePatchParameterBinding<number>({
        endpointID: oscillatorEndpointID("warpMode"),
        initialValue: 0,
        coerce: (value) => clamp(Math.round(Number(value) || 0), 0, 4),
    });
    const warpAmount = usePatchParameterBinding<number>({
        endpointID: oscillatorEndpointID("warpAmount"),
        initialValue: 0,
        coerce: (value) => clamp(Number(value) || 0, 0, 1),
    });
    const filterMode = usePatchParameterBinding<number>({
        endpointID: FILTER_MODE_ENDPOINT_ID,
        initialValue: FILTER_MODE_LOWPASS,
        coerce: (value) => clamp(Math.round(Number(value) || 0), 0, 5),
    });
    const filterCutoff = usePatchParameterBinding<number>({
        endpointID: FILTER_CUTOFF_ENDPOINT_ID,
        initialValue: 1000,
        coerce: (value) => clamp(Number(value) || 0, 20, 20_000),
    });
    const filterQ = usePatchParameterBinding<number>({
        endpointID: FILTER_Q_ENDPOINT_ID,
        initialValue: 0.707107,
        coerce: (value) => clamp(Number(value) || 0, 0.1, 20),
    });
    // T05: linear dry/wet blend, 1.0 = fully filtered (preserves every
    // existing patch; the appended engine endpoint defaults to 1).
    const filterMix = usePatchParameterBinding<number>({
        endpointID: FILTER_MIX_ENDPOINT_ID,
        initialValue: 1,
        coerce: (value) => {
            const numeric = Number(value);
            return clamp(Number.isFinite(numeric) ? numeric : 1, 0, 1);
        },
    });
    const unisonVoices = usePatchParameterBinding<number>({
        endpointID: oscillatorEndpointID("unisonVoices"),
        initialValue: 1,
        coerce: (value) => clamp(Math.round(Number(value) || 1), 1, 8),
    });
    const unisonDetune = usePatchParameterBinding<number>({
        endpointID: oscillatorEndpointID("unisonDetune"),
        initialValue: 0.1,
        coerce: (value) => clamp(Number(value) || 0, 0, 1),
        presentationPriority: "deferred-during-gesture",
    });
    const unisonBlend = usePatchParameterBinding<number>({
        endpointID: oscillatorEndpointID("unisonBlend"),
        initialValue: 0.75,
        coerce: (value) => clamp(Number(value) || 0, 0, 1),
        presentationPriority: "deferred-during-gesture",
    });
    const unisonWidth = usePatchParameterBinding<number>({
        endpointID: oscillatorEndpointID("unisonWidth"),
        initialValue: 1,
        coerce: (value) => clamp(Number(value) || 0, 0, 1),
        presentationPriority: "deferred-during-gesture",
    });
    const unisonPhase = usePatchParameterBinding<number>({
        endpointID: oscillatorEndpointID("phase"),
        initialValue: 0,
        coerce: (value) => clamp(Number(value) || 0, 0, 1),
        presentationPriority: "deferred-during-gesture",
    });
    const unisonRandom = usePatchParameterBinding<number>({
        endpointID: oscillatorEndpointID("phaseRandom"),
        initialValue: 0,
        coerce: (value) => clamp(Number(value) || 0, 0, 1),
        presentationPriority: "deferred-during-gesture",
    });
    const unisonPhaseMode = usePatchParameterBinding<number>({
        endpointID: oscillatorEndpointID("retrigger"),
        initialValue: 0,
        coerce: (value) => clamp(Math.round(Number(value) || 0), 0, 1),
    });
    const unisonDetuneMode = usePatchParameterBinding<number>({
        endpointID: oscillatorEndpointID("unisonDetuneMode"),
        initialValue: 0,
        coerce: (value) => clamp(Math.round(Number(value) || 0), 0, 4),
    });
    const unisonStackMode = usePatchParameterBinding<number>({
        endpointID: oscillatorEndpointID("unisonStackMode"),
        initialValue: 0,
        coerce: (value) => clamp(Math.round(Number(value) || 0), 0, 4),
    });
    const unisonWavetablePositionSpread = usePatchParameterBinding<number>({
        endpointID: oscillatorEndpointID("unisonWavetablePositionSpread"),
        initialValue: 0,
        coerce: (value) => clamp(Number(value) || 0, 0, 1),
        presentationPriority: "deferred-during-gesture",
    });
    const unisonWarpSpread = usePatchParameterBinding<number>({
        endpointID: oscillatorEndpointID("unisonWarpSpread"),
        initialValue: 0,
        coerce: (value) => clamp(Number(value) || 0, 0, 1),
        presentationPriority: "deferred-during-gesture",
    });
    const mseg1Morph = usePatchParameterBinding<number>({
        endpointID: MSEG_1_MORPH_ENDPOINT_ID,
        initialValue: 0,
        coerce: (value) => clamp(Number(value) || 0, 0, 1),
    });
    const mseg2Morph = usePatchParameterBinding<number>({
        endpointID: MSEG_2_MORPH_ENDPOINT_ID,
        initialValue: 0,
        coerce: (value) => clamp(Number(value) || 0, 0, 1),
    });
    const mseg3Morph = usePatchParameterBinding<number>({
        endpointID: MSEG_3_MORPH_ENDPOINT_ID,
        initialValue: 0,
        coerce: (value) => clamp(Number(value) || 0, 0, 1),
    });
    const mseg1Rate = usePatchParameterBinding<number>({
        endpointID: MSEG_1_RATE_ENDPOINT_ID,
        initialValue: 1,
        coerce: (value) => clampMsegRateSeconds(Number(value)),
    });
    const mseg2Rate = usePatchParameterBinding<number>({
        endpointID: MSEG_2_RATE_ENDPOINT_ID,
        initialValue: 1,
        coerce: (value) => clampMsegRateSeconds(Number(value)),
    });
    const mseg3Rate = usePatchParameterBinding<number>({
        endpointID: MSEG_3_RATE_ENDPOINT_ID,
        initialValue: 1,
        coerce: (value) => clampMsegRateSeconds(Number(value)),
    });
    const env1Attack = usePatchParameterBinding<number>({
        endpointID: ENV_1_ATTACK_ENDPOINT_ID,
        initialValue: 0.01,
        coerce: (value) => clamp(Number(value) || 0.001, 0.001, 10),
    });
    const env1Decay = usePatchParameterBinding<number>({
        endpointID: ENV_1_DECAY_ENDPOINT_ID,
        initialValue: 0.25,
        coerce: (value) => clamp(Number(value) || 0.001, 0.001, 10),
    });
    const env1Sustain = usePatchParameterBinding<number>({
        endpointID: ENV_1_SUSTAIN_ENDPOINT_ID,
        initialValue: 0.5,
        coerce: (value) => clamp(Number(value) || 0, 0, 1),
    });
    const env1Release = usePatchParameterBinding<number>({
        endpointID: ENV_1_RELEASE_ENDPOINT_ID,
        initialValue: 0.2,
        coerce: (value) => clamp(Number(value) || 0.001, 0.001, 10),
    });
    const env2Attack = usePatchParameterBinding<number>({
        endpointID: ENV_2_ATTACK_ENDPOINT_ID,
        initialValue: 0.01,
        coerce: (value) => clamp(Number(value) || 0.001, 0.001, 10),
    });
    const env2Decay = usePatchParameterBinding<number>({
        endpointID: ENV_2_DECAY_ENDPOINT_ID,
        initialValue: 0.25,
        coerce: (value) => clamp(Number(value) || 0.001, 0.001, 10),
    });
    const env2Sustain = usePatchParameterBinding<number>({
        endpointID: ENV_2_SUSTAIN_ENDPOINT_ID,
        initialValue: 0.5,
        coerce: (value) => clamp(Number(value) || 0, 0, 1),
    });
    const env2Release = usePatchParameterBinding<number>({
        endpointID: ENV_2_RELEASE_ENDPOINT_ID,
        initialValue: 0.2,
        coerce: (value) => clamp(Number(value) || 0.001, 0.001, 10),
    });
    const env3Attack = usePatchParameterBinding<number>({
        endpointID: ENV_3_ATTACK_ENDPOINT_ID,
        initialValue: 0.01,
        coerce: (value) => clamp(Number(value) || 0.001, 0.001, 10),
    });
    const env3Decay = usePatchParameterBinding<number>({
        endpointID: ENV_3_DECAY_ENDPOINT_ID,
        initialValue: 0.25,
        coerce: (value) => clamp(Number(value) || 0.001, 0.001, 10),
    });
    const env3Sustain = usePatchParameterBinding<number>({
        endpointID: ENV_3_SUSTAIN_ENDPOINT_ID,
        initialValue: 0.5,
        coerce: (value) => clamp(Number(value) || 0, 0, 1),
    });
    const env3Release = usePatchParameterBinding<number>({
        endpointID: ENV_3_RELEASE_ENDPOINT_ID,
        initialValue: 0.2,
        coerce: (value) => clamp(Number(value) || 0.001, 0.001, 10),
    });
    const distortionMode = useLaneParameterBinding(requireLaneParameterDescriptor("distortionMode"));
    const distortionDriveDb = useLaneParameterBinding(requireLaneParameterDescriptor("distortionDriveDb"));
    const distortionKnee = useLaneParameterBinding(requireLaneParameterDescriptor("distortionKnee"));
    const distortionWet = useLaneParameterBinding(requireLaneParameterDescriptor("distortionWet"));
    const distortionWetHPHz = useLaneParameterBinding(requireLaneParameterDescriptor("distortionWetHPHz"));
    const distortionWetLPHz = useLaneParameterBinding(requireLaneParameterDescriptor("distortionWetLPHz"));
    const distortionType = useLaneParameterBinding(requireLaneParameterDescriptor(DISTORTION_TYPE_ENDPOINT_ID));
    const chorusMix = useLaneParameterBinding(requireLaneParameterDescriptor("chorusMix"));
    const chorusMotionMode = useLaneParameterBinding(requireLaneParameterDescriptor("chorusMotionMode"));
    const chorusBloomMode = useLaneParameterBinding(requireLaneParameterDescriptor("chorusBloomMode"));
    const chorusTone = useLaneParameterBinding(requireLaneParameterDescriptor("chorusTone"));
    const chorusFeedback = useLaneParameterBinding(requireLaneParameterDescriptor("chorusFeedback"));
    const chorusRingAmount = useLaneParameterBinding(requireLaneParameterDescriptor("chorusRingAmount"));
    const chorusRingOffsetMode = useLaneParameterBinding(requireLaneParameterDescriptor("chorusRingOffsetMode"));
    const chorusRingFineSemitones = useLaneParameterBinding(requireLaneParameterDescriptor("chorusRingFineSemitones"));
    const requestRuntimeSync = usePatchEventTrigger<number>(RUNTIME_SYNC_REQUEST_ENDPOINT_ID);
    const retryDesiredTableLoad = usePatchEventTrigger<number>(RETRY_DESIRED_TABLE_REQUEST_ENDPOINT_ID);
    const prewarmWavetable = usePatchEventTrigger<number>(WAVETABLE_PREWARM_REQUEST_ENDPOINT_ID);
    const monitoredPosition = useObservedDisplayPosition(Number(wavetablePosition.value) || 0);
    const monitoredWarpState = useObservedWarpState({
        warpMode: warpMode.value,
        warpAmount: warpAmount.value,
    });
    const observedFilterState = useObservedFilterState({
        filterMode: filterMode.value,
        filterCutoff: filterCutoff.value,
        filterQ: filterQ.value,
    });
    const monitoredUnisonState = useObservedUnisonState({
        unisonVoices: unisonVoices.value,
        unisonDetune: unisonDetune.value,
        unisonBlend: unisonBlend.value,
        unisonWidth: unisonWidth.value,
        unisonDetuneMode: unisonDetuneMode.value,
        unisonStackMode: unisonStackMode.value,
        unisonWavetablePositionSpread: unisonWavetablePositionSpread.value,
        unisonWarpSpread: unisonWarpSpread.value,
    });
    const observedPosition = oscillatorID === "A"
        ? monitoredPosition
        : Number(wavetablePosition.value) || 0;
    const observedWarpState = oscillatorID === "A"
        ? monitoredWarpState
        : {
            voiceGeneration: -1,
            hasActive: false,
            mode: warpMode.value,
            amount: warpAmount.value,
        };
    const observedUnisonState = oscillatorID === "A"
        ? monitoredUnisonState
        : {
            voiceGeneration: -1,
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
    const observedFilterSpectrum = useObservedFilterSpectrum(observeFilterSpectrum);
    const observedDistortionHistory = useObservedDistortionHistory(observeDistortionVisuals);
    const observedDistortionScope = useObservedDistortionScope(observeDistortionVisuals);
    const observedMsegState = useObservedMsegState(observeMsegPlayhead);
    const voiceArticulationStartMessage = usePatchEndpoint<VoiceArticulationStartMessage | null>(
        VOICE_ARTICULATION_START_ENDPOINT_ID,
        null,
    );
    const { state: modulationState, bridge: modulationBridge } = useModulationState();
    const captureCurrentArticulationSnapshotRef = useRef<() => ArticulationSnapshot>(
        createDefaultArticulationSnapshot,
    );
    const articulationPatchBaseRef = useRef<Partial<Record<OscillatorID, ArticulationSnapshot>>>({});
    useEffect(() => {
        articulationPatchBaseRef.current = {};
    }, [patchConnection]);
    const setArticulationPatchBase = useCallback((
        targetOscillatorID: OscillatorID,
        snapshot: ArticulationSnapshot,
    ) => {
        articulationPatchBaseRef.current[targetOscillatorID] = snapshot;
    }, []);
    const currentArticulationPatchBase = useCallback(() => (
        articulationPatchBaseRef.current[oscillatorID]
        ?? captureCurrentArticulationSnapshotRef.current()
    ), [oscillatorID]);
    const articulationBankState = useStoredArticulationEditorState(
        modulationBridge,
        modulationState,
        currentArticulationPatchBase,
        oscillatorID,
    );
    const runtimePresentation = useMemo(
        () => resolveRuntimeTablePresentation(runtimeStateMessage, Number(wavetableSelect.value) || 0),
        [runtimeStateMessage, wavetableSelect.value],
    );
    const presentedTableIndex = runtimePresentation.presentedTableIndex ?? 0;
    const desiredTableIndex = runtimePresentation.desiredTableIndex ?? 0;
    const { frames, error: frameError } = useFactoryTableFrames(presentedTableIndex);
    const articulationBank = articulationBankState.bank;
    const articulationSlots = articulationBank.slots;
    const selectedArticulationSlot = useMemo(() => (
        articulationSlots.find((slot) => slot.id === articulationBank.selectedSlotId) ?? null
    ), [articulationBank.selectedSlotId, articulationSlots]);
    const isApplyingArticulationRef = useRef(false);
    const [selectedArticulationIsDirty, setSelectedArticulationIsDirty] = useState(false);
    const [discardedArticulationEdit, setDiscardedArticulationEdit] = useState<{
        slotId: string;
        slotName: string;
        snapshot: ArticulationSnapshot;
    } | null>(null);
    const presetStoredStateAdapters = useSynthPresetStoredStateAdapters({
        articulationBankState,
        modulationBridge,
        modulationState,
        setArticulationPatchBase,
    });
    const activeAuditionRef = useRef<{ slotId: string; note: number } | null>(null);
    const lastPlayedNoteRef = useRef(ARTICULATION_AUDITION_FALLBACK_NOTE);
    const [lastPlayedNote, setLastPlayedNote] = useState(ARTICULATION_AUDITION_FALLBACK_NOTE);
    const previewNoteMemoryRef = useRef<ReturnType<typeof createPreviewNoteMemory> | null>(null);
    const previewNoteMemory = previewNoteMemoryRef.current
        ?? createPreviewNoteMemory(ARTICULATION_AUDITION_FALLBACK_NOTE);
    previewNoteMemoryRef.current = previewNoteMemory;
    const heldMidiNotesRef = useRef(new Map<number, HeldMidiNote>());
    const heldMidiOrderRef = useRef(0);
    /** When the newest voice started (any note-on we emitted or tracked) — the T12B loop-phase anchor. */
    const lastNoteOnAtRef = useRef<number | null>(null);
    const [articulationHeldInput, setArticulationHeldInput] = useState<ArticulationHeldInput>({
        note: null,
        velocity: null,
        chain: null,
    });
    const [selectedMsegSlot, setSelectedMsegSlot] = useState(0);
    const [selectedEnvelopeSlot, setSelectedEnvelopeSlot] = useState(0);
    const msegMorphBindings = useMemo(
        () => [mseg1Morph, mseg2Morph, mseg3Morph] as const,
        [mseg1Morph, mseg2Morph, mseg3Morph],
    );
    const selectedMsegMorph = msegMorphBindings[selectedMsegSlot] ?? mseg1Morph;
    const msegRateBindings = useMemo(
        () => [mseg1Rate, mseg2Rate, mseg3Rate] as const,
        [mseg1Rate, mseg2Rate, mseg3Rate],
    );
    const selectedMsegRate = msegRateBindings[selectedMsegSlot] ?? mseg1Rate;
    const envelopeBindings = useMemo(() => [
        { attackSeconds: env1Attack, decaySeconds: env1Decay, sustain: env1Sustain, releaseSeconds: env1Release },
        { attackSeconds: env2Attack, decaySeconds: env2Decay, sustain: env2Sustain, releaseSeconds: env2Release },
        { attackSeconds: env3Attack, decaySeconds: env3Decay, sustain: env3Sustain, releaseSeconds: env3Release },
    ] as const, [
        env1Attack,
        env1Decay,
        env1Release,
        env1Sustain,
        env2Attack,
        env2Decay,
        env2Release,
        env2Sustain,
        env3Attack,
        env3Decay,
        env3Release,
        env3Sustain,
    ]);
    const displayedMsegControllerRef = useRef<MsegEditorControllerLike | null>(null);
    displayedMsegControllerRef.current = modulationBridge.current?.getMsegSlotController(selectedMsegSlot) ?? null;
    const routes = useMemo(() => modulationState?.routes ?? [], [modulationState?.routes]);
    const msegState = useMemo(() => {
        if (!modulationState || !modulationBridge.current) {
            return null;
        }
        const state = buildDisplayedMsegState(modulationBridge.current, selectedMsegSlot);
        return {
            ...state,
            playback: {
                ...state.playback,
                rate: { kind: "seconds" as const, seconds: selectedMsegRate.value },
            },
        };
    }, [modulationBridge, modulationState, selectedMsegRate.value, selectedMsegSlot]);
    const observedMsegPlayhead = useMemo(() => {
        return resolveMsegPreviewPlayheadState({
            observedState: observedMsegState,
            playback: msegState?.playback,
            slotIndex: selectedMsegSlot,
        });
    }, [msegState?.playback, observedMsegState, selectedMsegSlot]);
    const selectedEnvelope = useMemo(() => {
        const name = modulationState?.envelopeSlots[selectedEnvelopeSlot]?.name;
        const bindings = envelopeBindings[selectedEnvelopeSlot];
        if (!modulationState || !bindings) return null;
        return {
            name: name ?? `Env ${selectedEnvelopeSlot + 1}`,
            attackSeconds: bindings.attackSeconds.value,
            decaySeconds: bindings.decaySeconds.value,
            sustain: bindings.sustain.value,
            releaseSeconds: bindings.releaseSeconds.value,
        };
    }, [envelopeBindings, modulationState, selectedEnvelopeSlot]);
    const stageBindings = useStagePositionDrag({
        stageRef,
        observedPosition,
        binding: wavetablePosition,
    });
    const msegEditor = useMsegEditorInteractions({
        msegState,
        msegController: displayedMsegControllerRef,
        surfaceRef: msegEditorSurfaceRef,
        orientation: msegSurfaceOrientation,
        curveEditActivationMode: msegCurveEditActivationMode,
        onCurveEditHoldActivated: onMsegCurveEditHoldActivated,
    });
    const displayedTable = catalog?.tables?.[presentedTableIndex] ?? null;
    const desiredTable = catalog?.tables?.[desiredTableIndex] ?? displayedTable;
    const displayedFrameCount = displayedTable?.frameCount ?? frames?.length ?? 1;
    const failureDetail = describeRuntimeTableFailureDetails(
        runtimePresentation.isRetryableFailure ? normalizedRuntimeState : null,
        desiredTable?.name ?? "Requested wavetable",
    );
    const topStatus = runtimePresentation.failureMessage
        ?? (runtimePresentation.isPendingSelection && desiredTable ? `Loading ${desiredTable.name}…` : null)
        ?? (catalogError ? "Could not load the factory bank." : null)
        ?? (frameError ? "Could not render the current wavetable." : null)
        ?? "Ready";

    useEffect(() => {
        requestRuntimeSync(1);
    }, [requestRuntimeSync]);

    const prewarmWavetableNeighborhood = useCallback((centerTableIndex: number) => {
        const tableCount = catalog?.tables?.length ?? 0;

        if (tableCount <= 0) {
            return;
        }

        const maxTableIndex = tableCount - 1;
        const centerIndex = clamp(Math.round(Number(centerTableIndex) || 0), 0, maxTableIndex);
        const seenTableIndices = new Set<number>();

        for (const tableIndex of [centerIndex, centerIndex - 1, centerIndex + 1]) {
            if (tableIndex < 0 || tableIndex > maxTableIndex || seenTableIndices.has(tableIndex)) {
                continue;
            }

            seenTableIndices.add(tableIndex);
            prewarmWavetable(tableIndex);
        }
    }, [catalog?.tables?.length, prewarmWavetable]);

    const handleSelectWavetable = useCallback((nextValue: number) => {
        wavetableSelect.commitValue(nextValue);
        prewarmWavetableNeighborhood(nextValue);
    }, [prewarmWavetableNeighborhood, wavetableSelect]);

    const handleStepWavetable = useCallback((direction: ArrowStepDirection) => {
        const maxTableIndex = Math.max(0, (catalog?.tables?.length ?? 1) - 1);
        const nextTableIndex = clamp(desiredTableIndex + direction, 0, maxTableIndex);
        wavetableSelect.commitValue(nextTableIndex);
        prewarmWavetableNeighborhood(nextTableIndex);
    }, [catalog?.tables?.length, desiredTableIndex, prewarmWavetableNeighborhood, wavetableSelect]);

    const handlePrewarmWavetablePicker = useCallback(() => {
        prewarmWavetableNeighborhood(desiredTableIndex);
    }, [desiredTableIndex, prewarmWavetableNeighborhood]);

    const handleRetryLoad = useCallback(() => {
        retryDesiredTableLoad(oscillator.oscillatorIndex);
    }, [oscillator.oscillatorIndex, retryDesiredTableLoad]);

    const handleSelectMsegSlot = useCallback((slotIndex: number) => {
        setSelectedMsegSlot(clamp(Math.round(slotIndex), 0, 2));
    }, []);

    const handleSelectMsegShape = useCallback((shapeIndex: number) => {
        displayedMsegControllerRef.current?.setEditShapeIndex?.(shapeIndex);
    }, []);

    const handleSelectEnvelopeSlot = useCallback((slotIndex: number) => {
        setSelectedEnvelopeSlot(clamp(Math.round(slotIndex), 0, 2));
    }, []);

    const handleMsegRateChange = useCallback((nextValue: number) => {
        selectedMsegRate.setValue(clampMsegRateSeconds(nextValue));
    }, [selectedMsegRate]);

    const handleStepMsegRate = useCallback((direction: ArrowStepDirection) => {
        const nextRateSeconds = clampMsegRateSeconds(selectedMsegRate.value + (direction * 0.001));
        selectedMsegRate.setValue(nextRateSeconds);
    }, [selectedMsegRate]);

    const handleToggleMsegLoop = useCallback(() => {
        if (!msegState) {
            return;
        }

        displayedMsegControllerRef.current?.setPlayback({
            ...msegState.playback,
            loop: msegState.playback.loop ? null : { startX: 0, endX: 1 },
            noteOffPolicy: "finish_loop",
        });
    }, [msegState]);

    const handleMsegMorphChange = useCallback((nextValue: number) => {
        const nextMorph = clamp(Number(nextValue) || 0, 0, 1);
        const targetBinding = msegMorphBindings[selectedMsegSlot] ?? mseg1Morph;
        targetBinding.setValue(nextMorph);
    }, [mseg1Morph, msegMorphBindings, selectedMsegSlot]);

    const handleEnvelopeChange = useCallback((
        field: "attackSeconds" | "decaySeconds" | "sustain" | "releaseSeconds",
        nextValue: number,
    ) => {
        const selectedBindings = envelopeBindings[selectedEnvelopeSlot];
        if (!selectedBindings) {
            return;
        }
        selectedBindings[field].setValue(nextValue);
    }, [envelopeBindings, selectedEnvelopeSlot]);

    const handleAddRoute = useCallback(() => {
        const bridge = modulationBridge.current;
        if (!bridge) return;
        const targetOptions = oscillatorTargetsActive
            ? MODULATION_TARGET_OPTIONS
            : MODULATION_TARGET_OPTIONS.filter((option) => (
                !isOscillatorModulationTargetKind(option.value)
            ));
        const route = createFirstAvailableModulationRoute(bridge.getState().routes, targetOptions);
        if (route) bridge.addRoute(route);
    }, [modulationBridge, oscillatorTargetsActive]);

    const handleAddRouteWithOverrides = useCallback((overrides: GeneratedModulationRouteInput) => {
        if (!oscillatorTargetsActive && isOscillatorModulationTargetKind(overrides.targetKind)) {
            return false;
        }
        const bridge = modulationBridge.current;
        return bridge !== null && bridge.addGeneratedRoute(overrides) !== null;
    }, [modulationBridge, oscillatorTargetsActive]);

    const handleRemoveRoute = useCallback((routeIndex: number) => {
        modulationBridge.current?.removeRoute(routeIndex);
    }, [modulationBridge]);

    const handleRouteChange = useCallback((routeIndex: number, update: ModulationRouteUpdate) => {
        const bridge = modulationBridge.current;
        const currentRoute = bridge?.getState().routes[routeIndex];

        if (!bridge || !currentRoute) {
            return;
        }

        bridge.setRoute(routeIndex, { ...currentRoute, ...update });
    }, [modulationBridge]);

    const captureCurrentArticulationSnapshot = useCallback((): ArticulationSnapshot => {
        const currentModulationState = modulationBridge.current?.getState() ?? modulationState;

        return normalizeArticulationSnapshot({
            parameters: {
                wavetablePosition: wavetablePosition.value,
                pan: pan.value,
                octave: oscillatorOctave.value,
                semitone: oscillatorSemitone.value,
                fineCents: oscillatorFineCents.value,
                volumeDb: oscillatorVolumeDb.value,
                mute: oscillatorMute.value,
                solo: oscillatorSolo.value,
                warpMode: warpMode.value,
                warpAmount: warpAmount.value,
                filterMode: filterMode.value,
                filterCutoff: filterCutoff.value,
                filterQ: filterQ.value,
                unisonVoices: unisonVoices.value,
                unisonDetune: unisonDetune.value,
                unisonBlend: unisonBlend.value,
                unisonWidth: unisonWidth.value,
                unisonPhase: unisonPhase.value,
                unisonRandom: unisonRandom.value,
                unisonPhaseMode: unisonPhaseMode.value,
                unisonDetuneMode: unisonDetuneMode.value,
                unisonStackMode: unisonStackMode.value,
                unisonWavetablePositionSpread: unisonWavetablePositionSpread.value,
                unisonWarpSpread: unisonWarpSpread.value,
                msegMorphs: [mseg1Morph.value, mseg2Morph.value, mseg3Morph.value],
            },
            envelopes: envelopeBindings.map((bindings, slotIndex) => ({
                name: currentModulationState?.envelopeSlots[slotIndex]?.name
                    ?? createDefaultEnvelope(slotIndex).name,
                attackSeconds: bindings.attackSeconds.value,
                decaySeconds: bindings.decaySeconds.value,
                sustain: bindings.sustain.value,
                releaseSeconds: bindings.releaseSeconds.value,
            })),
            modRouteAmounts: (currentModulationState?.routes ?? []).flatMap((route) => (
                getModulationArticulationCellIndex(route) === null
                    ? []
                    : [{ routeId: route.id, amount: route.amount }]
            )),
        });
    }, [
        filterCutoff.value,
        filterMode.value,
        filterQ.value,
        envelopeBindings,
        modulationBridge,
        modulationState,
        mseg1Morph.value,
        mseg2Morph.value,
        mseg3Morph.value,
        oscillatorFineCents.value,
        oscillatorMute.value,
        oscillatorOctave.value,
        oscillatorSemitone.value,
        oscillatorSolo.value,
        oscillatorVolumeDb.value,
        pan.value,
        unisonBlend.value,
        unisonDetune.value,
        unisonDetuneMode.value,
        unisonPhase.value,
        unisonPhaseMode.value,
        unisonRandom.value,
        unisonStackMode.value,
        unisonVoices.value,
        unisonWarpSpread.value,
        unisonWavetablePositionSpread.value,
        unisonWidth.value,
        warpAmount.value,
        warpMode.value,
        wavetablePosition.value,
    ]);

    captureCurrentArticulationSnapshotRef.current = captureCurrentArticulationSnapshot;

    useEffect(() => {
        if (articulationPatchBaseRef.current[oscillatorID] === undefined) {
            articulationPatchBaseRef.current[oscillatorID] = captureCurrentArticulationSnapshot();
        }
    }, [captureCurrentArticulationSnapshot, oscillatorID]);

    const captureCurrentArticulationLayer = useCallback((): CapturedArticulationLayer => (
        projectArticulationSnapshotToVisibleV4Layer(captureCurrentArticulationSnapshot(), oscillatorID)
    ), [captureCurrentArticulationSnapshot, oscillatorID]);

    const applyArticulationSnapshot = useCallback((snapshotValue: unknown) => {
        const snapshot = normalizeArticulationSnapshot(snapshotValue);
        const parameters = snapshot.parameters;

        // Applying a snapshot writes through the scalar bindings but is not a
        // direct user edit: suppress the T12 user-edit seam for the batch.
        runProgrammaticWrites(() => {
            wavetablePosition.setValue(parameters.wavetablePosition);
            pan.setValue(parameters.pan);
            oscillatorOctave.setValue(parameters.octave);
            oscillatorSemitone.setValue(parameters.semitone);
            oscillatorFineCents.setValue(parameters.fineCents);
            oscillatorVolumeDb.setValue(parameters.volumeDb);
            oscillatorMute.setValue(parameters.mute);
            oscillatorSolo.setValue(parameters.solo);
            warpMode.setValue(parameters.warpMode);
            warpAmount.setValue(parameters.warpAmount);
            filterMode.setValue(parameters.filterMode);
            filterCutoff.setValue(parameters.filterCutoff);
            filterQ.setValue(parameters.filterQ);
            unisonVoices.setValue(parameters.unisonVoices);
            unisonDetune.setValue(parameters.unisonDetune);
            unisonBlend.setValue(parameters.unisonBlend);
            unisonWidth.setValue(parameters.unisonWidth);
            unisonPhase.setValue(parameters.unisonPhase);
            unisonRandom.setValue(parameters.unisonRandom);
            unisonPhaseMode.setValue(parameters.unisonPhaseMode);
            unisonDetuneMode.setValue(parameters.unisonDetuneMode);
            unisonStackMode.setValue(parameters.unisonStackMode);
            unisonWavetablePositionSpread.setValue(parameters.unisonWavetablePositionSpread);
            unisonWarpSpread.setValue(parameters.unisonWarpSpread);
            mseg1Morph.setValue(parameters.msegMorphs[0]);
            mseg2Morph.setValue(parameters.msegMorphs[1]);
            mseg3Morph.setValue(parameters.msegMorphs[2]);
        });

        const bridge = modulationBridge.current;
        runProgrammaticWrites(() => {
            snapshot.envelopes.forEach((envelope, envelopeIndex) => {
                const bindings = envelopeBindings[envelopeIndex];
                bindings?.attackSeconds.setValue(envelope.attackSeconds);
                bindings?.decaySeconds.setValue(envelope.decaySeconds);
                bindings?.sustain.setValue(envelope.sustain);
                bindings?.releaseSeconds.setValue(envelope.releaseSeconds);
            });
        });

        const currentRoutes = bridge?.getState().routes ?? modulationState?.routes ?? [];
        const routeAmountById = new Map(snapshot.modRouteAmounts.map((routeAmount) => [
            routeAmount.routeId,
            routeAmount.amount,
        ]));
        let hasRouteAmountChange = false;
        const nextRoutes = currentRoutes.map((route) => {
            if (!routeAmountById.has(route.id)) {
                return route;
            }

            const nextAmount = clampModulationRouteAmount(route.targetKind, routeAmountById.get(route.id) ?? route.amount);

            if (route.amount === nextAmount) {
                return route;
            }

            hasRouteAmountChange = true;
            return {
                ...route,
                amount: nextAmount,
            };
        });

        if (hasRouteAmountChange) {
            bridge?.replaceRoutes(nextRoutes);
        }
    }, [
        filterCutoff,
        filterMode,
        filterQ,
        envelopeBindings,
        modulationBridge,
        modulationState?.routes,
        mseg1Morph,
        mseg2Morph,
        mseg3Morph,
        oscillatorFineCents,
        oscillatorMute,
        oscillatorOctave,
        oscillatorSemitone,
        oscillatorSolo,
        oscillatorVolumeDb,
        pan,
        unisonBlend,
        unisonDetune,
        unisonDetuneMode,
        unisonPhase,
        unisonPhaseMode,
        unisonRandom,
        unisonStackMode,
        unisonVoices,
        unisonWarpSpread,
        unisonWavetablePositionSpread,
        unisonWidth,
        warpAmount,
        warpMode,
        wavetablePosition,
    ]);

    const handleCaptureArticulationSlot = useCallback((_options: { autoAssign?: boolean } = {}) => {
        const currentSnapshot = captureCurrentArticulationSnapshot();
        const baseSnapshot = currentArticulationPatchBase();
        articulationPatchBaseRef.current[oscillatorID] = baseSnapshot;
        const layer = diffCapturedArticulationLayerV4(
            captureCurrentArticulationLayer(),
            projectArticulationSnapshotToVisibleV4Layer(baseSnapshot, oscillatorID),
        );
        articulationBankState.setAndPersistState((previousState) => (
            addCapturedArticulationV4(previousState, layer)
        ));
        setSelectedArticulationIsDirty(false);
        setDiscardedArticulationEdit(null);
    }, [
        articulationBankState,
        captureCurrentArticulationLayer,
        captureCurrentArticulationSnapshot,
        currentArticulationPatchBase,
        oscillatorID,
    ]);

    const handleAddArticulationSlot = useCallback(() => {
        handleCaptureArticulationSlot({ autoAssign: true });
    }, [handleCaptureArticulationSlot]);

    const selectArticulationSlot = useCallback((slotId: string, options: { recordDirtyDiscard?: boolean } = {}) => {
        const state = articulationBankState.stateRef.current;
        const slot = state.slots.find((candidate) => candidate.id === slotId);

        if (!slot) {
            return;
        }

        const bank = articulationBankState.bankRef.current;
        const previousSlot = bank.slots.find((candidate) => candidate.id === bank.selectedSlotId) ?? null;
        const shouldRecordDirtyDiscard = options.recordDirtyDiscard !== false
            && selectedArticulationIsDirty
            && previousSlot
            && previousSlot.id !== slot.id;

        if (shouldRecordDirtyDiscard) {
            setDiscardedArticulationEdit({
                slotId: previousSlot.id,
                slotName: previousSlot.name,
                snapshot: captureCurrentArticulationSnapshot(),
            });
        }

        const baseSnapshot = currentArticulationPatchBase();
        articulationPatchBaseRef.current[oscillatorID] = baseSnapshot;
        const routes = modulationBridge.current?.getState().routes ?? modulationState?.routes ?? [];
        isApplyingArticulationRef.current = true;
        setSelectedArticulationIsDirty(false);
        applyArticulationSnapshot(resolveVisibleArticulationSnapshotV4(slot, baseSnapshot, routes, oscillatorID));
        setTimeout(() => {
            isApplyingArticulationRef.current = false;
        }, 0);

        articulationBankState.setAndPersistState((previousState) => selectArticulationV4(previousState, slotId));
    }, [
        applyArticulationSnapshot,
        articulationBankState,
        captureCurrentArticulationSnapshot,
        currentArticulationPatchBase,
        modulationBridge,
        modulationState?.routes,
        oscillatorID,
        selectedArticulationIsDirty,
    ]);

    const handleSelectArticulationSlot = useCallback((slotId: string) => {
        selectArticulationSlot(slotId);
    }, [selectArticulationSlot]);

    const handleUpdateSelectedArticulationSlot = useCallback(() => {
        const state = articulationBankState.stateRef.current;
        const slotId = state.selectedSlotId;

        if (!slotId) {
            return;
        }

        const currentSnapshot = captureCurrentArticulationSnapshot();
        const baseSnapshot = currentArticulationPatchBase();
        const routes = modulationBridge.current?.getState().routes ?? modulationState?.routes ?? [];
        articulationBankState.setAndPersistState((previousState) => replaceVisibleArticulationSnapshotV4(
            previousState,
            slotId,
            currentSnapshot,
            baseSnapshot,
            routes,
            oscillatorID,
        ));
        setSelectedArticulationIsDirty(false);
        setDiscardedArticulationEdit(null);
    }, [
        articulationBankState,
        captureCurrentArticulationSnapshot,
        currentArticulationPatchBase,
        modulationBridge,
        modulationState?.routes,
        oscillatorID,
    ]);

    const handleRevertSelectedArticulationSlot = useCallback(() => {
        const state = articulationBankState.stateRef.current;
        const slot = state.slots.find((candidate) => candidate.id === state.selectedSlotId);

        if (!slot) {
            return;
        }

        if (selectedArticulationIsDirty) {
            setDiscardedArticulationEdit({
                slotId: slot.id,
                slotName: slot.name,
                snapshot: captureCurrentArticulationSnapshot(),
            });
        }

        isApplyingArticulationRef.current = true;
        setSelectedArticulationIsDirty(false);
        const baseSnapshot = currentArticulationPatchBase();
        const routes = modulationBridge.current?.getState().routes ?? modulationState?.routes ?? [];
        applyArticulationSnapshot(resolveVisibleArticulationSnapshotV4(slot, baseSnapshot, routes, oscillatorID));
        setTimeout(() => {
            isApplyingArticulationRef.current = false;
        }, 0);
    }, [
        applyArticulationSnapshot,
        articulationBankState,
        captureCurrentArticulationSnapshot,
        currentArticulationPatchBase,
        modulationBridge,
        modulationState?.routes,
        oscillatorID,
        selectedArticulationIsDirty,
    ]);

    const handleUndoDiscardedArticulationEdit = useCallback(() => {
        const edit = discardedArticulationEdit;

        if (!edit) {
            return;
        }

        isApplyingArticulationRef.current = true;
        setDiscardedArticulationEdit(null);
        applyArticulationSnapshot(edit.snapshot);
        articulationBankState.setAndPersistState((previousState) => (
            selectArticulationV4(previousState, edit.slotId)
        ));
        setTimeout(() => {
            isApplyingArticulationRef.current = false;
            setSelectedArticulationIsDirty(true);
        }, 0);
    }, [applyArticulationSnapshot, articulationBankState, discardedArticulationEdit]);

    const handleSetArticulationTriggerMode = useCallback((mode: ArticulationTriggerMode) => {
        articulationBankState.setAndPersistState((previousState) => (
            setArticulationTriggerModeV4(previousState, mode)
        ));
    }, [articulationBankState]);

    const updateArticulationStateIfChanged = useCallback((
        update: (previousState: ArticulationsState) => ArticulationsState,
    ) => {
        const previousState = articulationBankState.stateRef.current;
        const nextState = update(previousState);

        if (articulationStatesEqual(previousState, nextState)) {
            return false;
        }

        articulationBankState.setAndPersistState(nextState);
        return true;
    }, [articulationBankState]);

    const handleAssignArticulationRangePosition = useCallback((
        mode: ArticulationTriggerMode,
        position: number,
        articulationId: string,
    ) => {
        return updateArticulationStateIfChanged((previousState) => (
            assignArticulationPositionV4(previousState, mode, position, articulationId)
        ));
    }, [updateArticulationStateIfChanged]);

    const handleInsertArticulationRangeAtPosition = useCallback((
        mode: ArticulationTriggerMode,
        position: number,
        articulationId: string,
        preserveSide?: ArticulationInsertPreserveSide,
    ) => {
        return updateArticulationStateIfChanged((previousState) => (
            insertArticulationPositionV4(previousState, mode, position, articulationId, preserveSide)
        ));
    }, [updateArticulationStateIfChanged]);

    const handleDuplicateAndAssignArticulationRangePosition = useCallback((
        mode: ArticulationTriggerMode,
        position: number,
        articulationId: string,
        operation: "assign" | "insert",
    ) => {
        const previousState = articulationBankState.stateRef.current;
        const duplicatedState = duplicateArticulationV4(previousState, articulationId);
        const nextSlotId = duplicatedState.selectedSlotId;

        if (
            articulationStatesEqual(previousState, duplicatedState)
            || !nextSlotId
        ) {
            return false;
        }

        const assignedState = operation === "insert"
            ? insertArticulationPositionV4(duplicatedState, mode, position, nextSlotId)
            : assignArticulationPositionV4(duplicatedState, mode, position, nextSlotId);

        if (articulationStatesEqual(duplicatedState, assignedState)) {
            return false;
        }

        const nextSlot = assignedState.slots.find((slot) => slot.id === nextSlotId);
        articulationBankState.setAndPersistState(assignedState);

        if (nextSlot) {
            const baseSnapshot = currentArticulationPatchBase();
            const routes = modulationBridge.current?.getState().routes ?? modulationState?.routes ?? [];
            isApplyingArticulationRef.current = true;
            setSelectedArticulationIsDirty(false);
            applyArticulationSnapshot(resolveVisibleArticulationSnapshotV4(nextSlot, baseSnapshot, routes, oscillatorID));
            setTimeout(() => {
                isApplyingArticulationRef.current = false;
            }, 0);
        }

        return true;
    }, [
        applyArticulationSnapshot,
        articulationBankState,
        captureCurrentArticulationSnapshot,
        currentArticulationPatchBase,
        modulationBridge,
        modulationState?.routes,
        oscillatorID,
    ]);

    const handleMoveArticulationRangeAssignment = useCallback((
        mode: ArticulationTriggerMode,
        segment: ArticulationRangeAssignment,
        targetPosition: number,
    ) => {
        return updateArticulationStateIfChanged((previousState) => (
            moveArticulationSegmentV4(previousState, mode, segment, targetPosition)
        ));
    }, [updateArticulationStateIfChanged]);

    const handleResizeArticulationRangeAssignment = useCallback((
        mode: ArticulationTriggerMode,
        segment: ArticulationRangeAssignment,
        edge: ArticulationRangeEditEdge,
        position: number,
    ) => {
        return updateArticulationStateIfChanged((previousState) => (
            resizeArticulationSegmentV4(previousState, mode, segment, edge, position)
        ));
    }, [updateArticulationStateIfChanged]);

    const handleClearArticulationRangeAssignment = useCallback((
        mode: ArticulationTriggerMode,
        segment: ArticulationRangeAssignment,
    ) => {
        return updateArticulationStateIfChanged((previousState) => (
            collapseArticulationSegmentV4(previousState, mode, segment)
        ));
    }, [updateArticulationStateIfChanged]);

    const handleClearArticulationTriggerAssignments = useCallback((mode: ArticulationTriggerMode) => {
        articulationBankState.setAndPersistState((previousState) => (
            collapseAllArticulationSegmentsV4(previousState, mode)
        ));
    }, [articulationBankState]);

    const handleDistributeArticulationRanges = useCallback((mode: ArticulationTriggerMode) => {
        articulationBankState.setAndPersistState((previousState) => (
            distributeArticulationSegmentsV4(previousState, mode)
        ));
    }, [articulationBankState]);

    const handleRenameArticulationSlot = useCallback((slotId: string, nextName: string) => {
        articulationBankState.setAndPersistState((previousState) => (
            renameArticulationV4(previousState, slotId, nextName)
        ));
    }, [articulationBankState]);

    const handleReplaceArticulationSlotWithCurrent = useCallback((slotId: string) => {
        const currentSnapshot = captureCurrentArticulationSnapshot();
        const baseSnapshot = currentArticulationPatchBase();
        const routes = modulationBridge.current?.getState().routes ?? modulationState?.routes ?? [];
        articulationBankState.setAndPersistState((previousState) => replaceVisibleArticulationSnapshotV4(
            previousState,
            slotId,
            currentSnapshot,
            baseSnapshot,
            routes,
            oscillatorID,
        ));

        if (articulationBankState.bankRef.current.selectedSlotId === slotId) {
            setSelectedArticulationIsDirty(false);
        }
    }, [
        articulationBankState,
        captureCurrentArticulationSnapshot,
        currentArticulationPatchBase,
        modulationBridge,
        modulationState?.routes,
        oscillatorID,
    ]);

    const handleDuplicateArticulationSlot = useCallback((slotId: string) => {
        const nextState = duplicateArticulationV4(articulationBankState.stateRef.current, slotId);
        const nextSlot = nextState.slots.find((slot) => slot.id === nextState.selectedSlotId);

        articulationBankState.setAndPersistState(nextState);

        if (nextSlot) {
            const baseSnapshot = currentArticulationPatchBase();
            const routes = modulationBridge.current?.getState().routes ?? modulationState?.routes ?? [];
            isApplyingArticulationRef.current = true;
            setSelectedArticulationIsDirty(false);
            applyArticulationSnapshot(resolveVisibleArticulationSnapshotV4(nextSlot, baseSnapshot, routes, oscillatorID));
            setTimeout(() => {
                isApplyingArticulationRef.current = false;
            }, 0);
        }
    }, [
        applyArticulationSnapshot,
        articulationBankState,
        captureCurrentArticulationSnapshot,
        currentArticulationPatchBase,
        modulationBridge,
        modulationState?.routes,
        oscillatorID,
    ]);

    const handleDeleteArticulationSlot = useCallback((slotId: string) => {
        const previousState = articulationBankState.stateRef.current;
        const nextState = deleteArticulationV4(previousState, slotId);
        const selectedChanged = nextState.selectedSlotId !== previousState.selectedSlotId;
        const nextSlot = nextState.slots.find((slot) => slot.id === nextState.selectedSlotId);

        articulationBankState.setAndPersistState(nextState);

        if (selectedChanged && nextSlot) {
            const baseSnapshot = currentArticulationPatchBase();
            const routes = modulationBridge.current?.getState().routes ?? modulationState?.routes ?? [];
            isApplyingArticulationRef.current = true;
            setSelectedArticulationIsDirty(false);
            applyArticulationSnapshot(resolveVisibleArticulationSnapshotV4(nextSlot, baseSnapshot, routes, oscillatorID));
            setTimeout(() => {
                isApplyingArticulationRef.current = false;
            }, 0);
        }
    }, [
        applyArticulationSnapshot,
        articulationBankState,
        captureCurrentArticulationSnapshot,
        currentArticulationPatchBase,
        modulationBridge,
        modulationState?.routes,
        oscillatorID,
    ]);

    const publishHeldMidiNote = useCallback((nextChainValue?: number | null) => {
        let newest: { note: number; velocity: number; order: number } | null = null;

        heldMidiNotesRef.current.forEach((heldNote, note) => {
            if (!newest || heldNote.order > newest.order) {
                newest = { note, velocity: heldNote.velocity, order: heldNote.order };
            }
        });

        setArticulationHeldInput((previousValue) => {
            const chain = nextChainValue === undefined ? previousValue.chain : nextChainValue;
            const nextValue = newest
                ? {
                    note: newest.note,
                    velocity: newest.velocity,
                    chain,
                }
                : nextChainValue !== undefined
                    ? {
                        note: null,
                        velocity: null,
                        chain,
                    }
                : {
                    note: null,
                    velocity: null,
                    chain: null,
                };

            return previousValue.note === nextValue.note
                && previousValue.velocity === nextValue.velocity
                && previousValue.chain === nextValue.chain
                ? previousValue
                : nextValue;
        });
    }, []);

    const trackMidiInputForArticulationLane = useCallback((
        status: number,
        note: number,
        intentional: boolean,
        velocity = 0,
    ) => {
        const messageKind = status & 0xf0;
        const safeNote = clamp(Math.round(note), 0, 127);
        const safeVelocity = clamp(Math.round(velocity), 0, 127);
        const isNoteOn = messageKind === 0x90 && safeVelocity > 0;
        const isNoteOff = messageKind === 0x80 || (messageKind === 0x90 && safeVelocity === 0);
        const heldCountBefore = heldMidiNotesRef.current.size;

        if (isNoteOn) {
            // The newest note-on anchors every per-voice MSEG loop's phase
            // (T12B): loop-sync boundaries are computed from this moment.
            lastNoteOnAtRef.current = performance.now();
            if (intentional) {
                lastPlayedNoteRef.current = safeNote;
                setLastPlayedNote(safeNote);
            }
            previewNoteMemory.noteOn(safeNote, intentional);
            heldMidiNotesRef.current.set(safeNote, {
                velocity: safeVelocity,
                order: heldMidiOrderRef.current += 1,
            });
            if (heldCountBefore === 0 && heldMidiNotesRef.current.size === 1) {
                // endPreview turns a deferred hold strike into a capped one;
                // remove that reach-in state and every owned gate first.
                autoPreviewClearPendingRef.current?.();
                autoPreviewReleaseOwnedRef.current?.();
                autoPreviewEngineRef.current?.manualHoldStarted();
            }
            publishHeldMidiNote();
            return;
        }

        if (isNoteOff) {
            previewNoteMemory.noteOff(safeNote);
            heldMidiNotesRef.current.delete(safeNote);
            if (heldCountBefore > 0 && heldMidiNotesRef.current.size === 0) {
                autoPreviewEngineRef.current?.manualHoldEnded();
            }
            publishHeldMidiNote();
        }
    }, [previewNoteMemory, publishHeldMidiNote]);

    const trackIntentionalNoteInput = useCallback((status: number, note: number, velocity = 0) => {
        trackMidiInputForArticulationLane(status, note, true, velocity);
    }, [trackMidiInputForArticulationLane]);

    const sendMidiInputEvent = useCallback((status: number, note: number, velocity = 0) => {
        trackMidiInputForArticulationLane(status, note, false, velocity);
        patchConnection.sendMIDIInputEvent?.(MIDI_INPUT_ENDPOINT_ID, buildShortMidi(status, note, velocity));
    }, [patchConnection, trackMidiInputForArticulationLane]);

    const handleStopArticulationAudition = useCallback((slotId?: string) => {
        const activeAudition = activeAuditionRef.current;

        if (!activeAudition || (slotId && activeAudition.slotId !== slotId)) {
            return;
        }

        sendMidiInputEvent(0x80, activeAudition.note, 0);
        activeAuditionRef.current = null;
    }, [sendMidiInputEvent]);

    const handleStartArticulationAudition = useCallback((slotId: string) => {
        handleStopArticulationAudition();
        selectArticulationSlot(slotId);

        const note = clamp(Math.round(lastPlayedNoteRef.current), 0, 127);
        activeAuditionRef.current = { slotId, note };
        sendMidiInputEvent(0x90, note, 100);
    }, [handleStopArticulationAudition, selectArticulationSlot, sendMidiInputEvent]);

    // The Mod rail's Note key (T10B): one piano key fixed to the most recently
    // played intentional pitch. It goes through sendMidiInputEvent so it joins
    // the held set without replacing chord memory, and it remembers its own
    // started pitch so a keyboard note played mid-press cannot orphan the
    // eventual note-off.
    const noteKeyAuditionRef = useRef<{ note: number } | null>(null);

    const handleStopNoteKeyAudition = useCallback(() => {
        const activeNoteKey = noteKeyAuditionRef.current;

        if (!activeNoteKey) {
            return;
        }

        noteKeyAuditionRef.current = null;
        sendMidiInputEvent(0x80, activeNoteKey.note, 0);
    }, [sendMidiInputEvent]);

    const handleStartNoteKeyAudition = useCallback(() => {
        handleStopNoteKeyAudition();

        const note = clamp(Math.round(lastPlayedNoteRef.current), 0, 127);
        noteKeyAuditionRef.current = { note };
        sendMidiInputEvent(0x90, note, 100);
    }, [handleStopNoteKeyAudition, sendMidiInputEvent]);

    // ── Auto-preview (T12/T12C): when no manual notes are held, retrigger the
    // most recent completed intentional group after a real changed edit.
    // Engine-owned strikes take the raw connection so they never disturb the
    // held-note, chord-memory, or last-played bookkeeping.
    const autoPreviewEnabledRef = useRef(autoPreviewEnabled);
    autoPreviewEnabledRef.current = autoPreviewEnabled;
    const autoPreviewEngineRef = useRef<AutoPreviewEngine | null>(null);
    const autoPreviewOwnedGroupRef = useRef<AutoPreviewOwnedGroup | null>(null);
    const autoPreviewOffTimerRef = useRef<number | null>(null);
    // T12B loop-sync state: the strike currently deferred to a loop boundary,
    // a reach-in to clear it from outside the mount closure, and live MSEG
    // rates mirrored for the resolver.
    const autoPreviewPendingStrikeRef = useRef<{ timer: number; capMs: number | null } | null>(null);
    const autoPreviewClearPendingRef = useRef<(() => void) | null>(null);
    const autoPreviewReleaseOwnedRef = useRef<(() => void) | null>(null);
    const browserAudioAwayRef = useRef(false);
    const msegRatesRef = useRef<[number, number, number]>([1, 1, 1]);
    msegRatesRef.current = [mseg1Rate.value, mseg2Rate.value, mseg3Rate.value];

    // Dev builds may swap the preview algorithm live from the tuning page;
    // release builds always run the shipped engine.
    const perfTuningAlgorithm = useSyncExternalStore(
        subscribePerfTuning,
        () => getPerfTuningState().algorithm,
    );
    const activePreviewAlgorithm = PERF_TUNING_AVAILABLE ? perfTuningAlgorithm : "shipped";

    useEffect(() => {
        const sendRawMidi = (status: number, note: number, velocity: number) => {
            patchConnection.sendMIDIInputEvent?.(MIDI_INPUT_ENDPOINT_ID, buildShortMidi(status, note, velocity));
        };
        const clearOwnedOffTimer = () => {
            if (autoPreviewOffTimerRef.current !== null) {
                window.clearTimeout(autoPreviewOffTimerRef.current);
                autoPreviewOffTimerRef.current = null;
            }
        };
        const releaseOwnedGroup = () => {
            clearOwnedOffTimer();
            const owned = autoPreviewOwnedGroupRef.current;
            if (owned) {
                autoPreviewOwnedGroupRef.current = null;
                for (const pitch of owned.pitches) {
                    sendRawMidi(0x80, pitch, 0);
                }
            }
        };
        autoPreviewReleaseOwnedRef.current = releaseOwnedGroup;
        const scheduleOwnedRelease = (delayMs: number) => {
            clearOwnedOffTimer();
            autoPreviewOffTimerRef.current = window.setTimeout(() => {
                autoPreviewOffTimerRef.current = null;
                releaseOwnedGroup();
            }, Math.max(0, delayMs));
        };
        const clearPendingStrike = () => {
            const pending = autoPreviewPendingStrikeRef.current;
            if (pending) {
                autoPreviewPendingStrikeRef.current = null;
                window.clearTimeout(pending.timer);
            }
        };
        autoPreviewClearPendingRef.current = clearPendingStrike;
        // T12B: the slowest looping MSEG that modulates anything is the
        // audible rhythm; its cycle grid (anchored at the newest note-on,
        // which restarts every per-voice MSEG) is what strikes align to.
        // Unmapped MSEGs are ignored entirely.
        const resolveLoopSyncSource = (): LoopSyncSource | null => {
            const anchorMs = lastNoteOnAtRef.current;
            const sounding = autoPreviewOwnedGroupRef.current !== null || heldMidiNotesRef.current.size > 0;
            if (anchorMs === null || !sounding) {
                return null;
            }
            const bridgeState = modulationBridge.current?.getState();
            if (!bridgeState) {
                return null;
            }
            let slowestPeriodMs = 0;
            for (const slotIndex of [0, 1, 2] as const) {
                const loop = bridgeState.msegSlots[slotIndex]?.playback.loop ?? null;
                const rateSeconds = msegRatesRef.current[slotIndex];
                if (!loop || !(rateSeconds > 0)) {
                    continue;
                }
                const periodMs = (loop.endX - loop.startX) * rateSeconds * 1000;
                if (!(periodMs > 0)) {
                    continue;
                }
                const isRouted = bridgeState.routes.some((route) => (
                    route.enabled && route.sourceKind === "mseg" && route.sourceSlot === slotIndex + 1
                ));
                if (!isRouted) {
                    continue;
                }
                slowestPeriodMs = Math.max(slowestPeriodMs, periodMs);
            }
            return slowestPeriodMs > 0 ? { periodMs: slowestPeriodMs, anchorMs } : null;
        };
        const strikePreviewNow = (strikeCapMs: number | null) => {
            const strikeAtMs = performance.now();
            const pitches = previewNoteMemory.rememberedGroup();
            releaseOwnedGroup();
            autoPreviewOwnedGroupRef.current = { pitches, startedAt: strikeAtMs };
            for (const pitch of pitches) {
                sendRawMidi(0x90, pitch, 100);
            }
            lastNoteOnAtRef.current = strikeAtMs;
            if (strikeCapMs !== null) {
                scheduleOwnedRelease(strikeCapMs);
            }
        };
        const scheduleAtViaTimeout = (atMs: number, callback: () => void) => {
            const handle = window.setTimeout(callback, Math.max(0, atMs - performance.now()));
            return () => window.clearTimeout(handle);
        };
        const createShippedEngine = () => createAutoPreviewEngine({
            scheduler: createAutoPreviewScheduler(AUTO_PREVIEW_SCHEDULER_CONFIG),
            movementStoppedMs: AUTO_PREVIEW_SCHEDULER_CONFIG.movementStoppedMs,
            now: () => performance.now(),
            scheduleAt: scheduleAtViaTimeout,
            playPreview: (capMs) => {
                clearPendingStrike();
                const now = performance.now();
                const sounding = autoPreviewOwnedGroupRef.current !== null
                    || heldMidiNotesRef.current.size > 0;
                const kind: AutoPreviewStrikeKind = capMs !== null
                    ? "trailing"
                    : sounding ? "inMotion" : "leading";
                const strikeAt = quantizeStrikeTime({
                    now,
                    kind,
                    source: resolveLoopSyncSource(),
                    config: AUTO_PREVIEW_SYNC_CONFIG,
                });
                if (strikeAt <= now) {
                    strikePreviewNow(capMs);
                    return;
                }
                const pending: { timer: number; capMs: number | null } = { timer: 0, capMs };
                pending.timer = window.setTimeout(() => {
                    if (autoPreviewPendingStrikeRef.current !== pending) {
                        return;
                    }
                    autoPreviewPendingStrikeRef.current = null;
                    strikePreviewNow(pending.capMs);
                }, Math.max(0, strikeAt - now));
                autoPreviewPendingStrikeRef.current = pending;
            },
            endPreview: () => {
                // Every cancel path clears the pending strike explicitly
                // before reaching the engine, so an endPreview arriving with
                // one still pending is a RELEASE: convert the deferred hold
                // strike into the self-releasing capped final note so the
                // last value is still heard, on the beat.
                const pending = autoPreviewPendingStrikeRef.current;
                if (pending && pending.capMs === null) {
                    pending.capMs = AUTO_PREVIEW_SCHEDULER_CONFIG.releaseNoteCapMs;
                }
                const owned = autoPreviewOwnedGroupRef.current;
                if (!owned) {
                    return;
                }
                // A preview released in the instant it started (a discrete
                // commit is begin+set+end in one breath) still gets a brief
                // audible life.
                const age = performance.now() - owned.startedAt;
                if (age < AUTO_PREVIEW_MIN_NOTE_MS) {
                    scheduleOwnedRelease(AUTO_PREVIEW_MIN_NOTE_MS - age);
                    return;
                }
                releaseOwnedGroup();
            },
        });
        // The dev tuning page's alternative feels (T12 follow-up): same engine
        // surface, different retrigger policy. Strategy strikes are held notes
        // choked by the next strike; release comes from the strategy itself.
        const createStrategyEngine = () => createPreviewStrategyEngine({
            algorithm: activePreviewAlgorithm as Exclude<typeof activePreviewAlgorithm, "shipped">,
            params: () => {
                const tuning = getPerfTuningState();
                return {
                    settleMs: tuning.settleMs,
                    minGapMs: tuning.minGapMs,
                    holdMs: tuning.holdMs,
                    loopSync: tuning.loopSync,
                };
            },
            now: () => performance.now(),
            scheduleAt: scheduleAtViaTimeout,
            strike: () => {
                clearPendingStrike();
                strikePreviewNow(null);
            },
            release: () => {
                clearPendingStrike();
                releaseOwnedGroup();
            },
            quantizeStrike: (nowMs, kind) => quantizeStrikeTime({
                now: nowMs,
                kind,
                source: resolveLoopSyncSource(),
                config: AUTO_PREVIEW_SYNC_CONFIG,
            }),
            nextLoopBoundary: (nowMs) => {
                const source = resolveLoopSyncSource();
                if (!source || !(source.periodMs > 0)) {
                    return null;
                }
                const cycles = Math.max(1, Math.ceil((nowMs - source.anchorMs) / source.periodMs));
                return source.anchorMs + (cycles * source.periodMs);
            },
        });
        const engine = activePreviewAlgorithm === "shipped"
            ? createShippedEngine()
            : createStrategyEngine();
        autoPreviewEngineRef.current = engine;
        if (heldMidiNotesRef.current.size > 0) {
            engine.manualHoldStarted();
        }
        engine.setEnabled(
            autoPreviewEnabledRef.current
            && document.visibilityState === "visible"
            && !browserAudioAwayRef.current,
        );
        const unsubscribe = subscribeToUserEdits({
            onParameterEdit: (edit) => engine.parameterEdited(edit.changed),
            onGestureStart: () => engine.gestureStarted(),
            onGestureEnd: () => engine.gestureEnded(),
        });
        // Returning restores the user's preference. Every leave signal is
        // handled by the shared sounding-owner panic below.
        const handleResume = () => {
            if (!browserAudioAwayRef.current) {
                engine.setEnabled(autoPreviewEnabledRef.current);
            }
        };
        const handleBrowserAudioReturn = () => {
            browserAudioAwayRef.current = false;
            handleResume();
        };
        const handleVisibility = () => {
            if (document.visibilityState === "visible") {
                handleResume();
            }
        };
        window.addEventListener("focus", handleResume);
        window.addEventListener(BROWSER_AUDIO_RETURN_EVENT, handleBrowserAudioReturn);
        document.addEventListener("visibilitychange", handleVisibility);
        return () => {
            window.removeEventListener("focus", handleResume);
            window.removeEventListener(BROWSER_AUDIO_RETURN_EVENT, handleBrowserAudioReturn);
            document.removeEventListener("visibilitychange", handleVisibility);
            unsubscribe();
            engine.dispose();
            clearPendingStrike();
            releaseOwnedGroup();
            autoPreviewClearPendingRef.current = null;
            autoPreviewReleaseOwnedRef.current = null;
            autoPreviewEngineRef.current = null;
        };
    }, [activePreviewAlgorithm, patchConnection]);

    useEffect(() => {
        if (!autoPreviewEnabled) {
            // Disabling must also drop a strike still waiting on a loop
            // boundary — the engine cannot see it.
            autoPreviewClearPendingRef.current?.();
        }
        autoPreviewEngineRef.current?.setEnabled(
            autoPreviewEnabled
            && document.visibilityState === "visible"
            && !browserAudioAwayRef.current,
        );
    }, [autoPreviewEnabled]);

    useEffect(() => {
        if (!voiceArticulationStartMessage) {
            return;
        }

        const hasArticulation = Boolean(voiceArticulationStartMessage.hasArticulation);
        const selectorA = Number(voiceArticulationStartMessage.selectorA);

        publishHeldMidiNote(
            hasArticulation && Number.isFinite(selectorA)
                ? clamp(Math.round(selectorA), 0, 127)
                : null,
        );
    }, [publishHeldMidiNote, voiceArticulationStartMessage]);

    useEffect(() => {
        const releaseSoundingOwners = () => {
            handleStopArticulationAudition();
            handleStopNoteKeyAudition();
            autoPreviewClearPendingRef.current?.();
            autoPreviewEngineRef.current?.setEnabled(false);
            autoPreviewReleaseOwnedRef.current?.();
        };
        const handleBrowserAudioLeave = () => {
            browserAudioAwayRef.current = true;
            releaseSoundingOwners();
        };
        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === "Escape") {
                handleStopArticulationAudition();
                handleStopNoteKeyAudition();
            }
        };
        const handleVisibilityChange = () => {
            // Mobile backgrounding fires visibilitychange without a reliable
            // blur; suspension must never leave an owned note held.
            if (document.visibilityState !== "visible") {
                releaseSoundingOwners();
            }
        };

        window.addEventListener("blur", releaseSoundingOwners);
        window.addEventListener(BROWSER_AUDIO_LEAVE_EVENT, handleBrowserAudioLeave);
        window.addEventListener("keydown", handleKeyDown);
        document.addEventListener("visibilitychange", handleVisibilityChange);
        return () => {
            window.removeEventListener("blur", releaseSoundingOwners);
            window.removeEventListener(BROWSER_AUDIO_LEAVE_EVENT, handleBrowserAudioLeave);
            window.removeEventListener("keydown", handleKeyDown);
            document.removeEventListener("visibilitychange", handleVisibilityChange);
        };
    }, [handleStopArticulationAudition, handleStopNoteKeyAudition]);

    useEffect(() => () => {
        const activeAudition = activeAuditionRef.current;

        if (activeAudition) {
            patchConnection.sendMIDIInputEvent?.(
                MIDI_INPUT_ENDPOINT_ID,
                buildShortMidi(0x80, activeAudition.note, 0),
            );
            activeAuditionRef.current = null;
        }

        const activeNoteKey = noteKeyAuditionRef.current;

        if (activeNoteKey) {
            patchConnection.sendMIDIInputEvent?.(
                MIDI_INPUT_ENDPOINT_ID,
                buildShortMidi(0x80, activeNoteKey.note, 0),
            );
            noteKeyAuditionRef.current = null;
        }
    }, [patchConnection]);

    useEffect(() => {
        if (
            !articulationBankState.hasHydrated
            || !selectedArticulationSlot
        ) {
            setSelectedArticulationIsDirty(false);
            return;
        }

        if (isApplyingArticulationRef.current) {
            return;
        }

        const currentSnapshot = captureCurrentArticulationSnapshot();
        const isDirty = !articulationSnapshotsEqual(selectedArticulationSlot.snapshot, currentSnapshot);
        setSelectedArticulationIsDirty((previousValue) => (
            previousValue === isDirty ? previousValue : isDirty
        ));
    }, [
        articulationBankState,
        captureCurrentArticulationSnapshot,
        selectedArticulationSlot,
    ]);

    const handleStepPlayMode = useCallback((direction: ArrowStepDirection) => {
        playMode.commitValue(
            clamp(playMode.value + direction, 0, Math.max(0, voiceModeCount - 1)),
        );
    }, [playMode, voiceModeCount]);

    const handleStepGlideTime = useCallback((direction: ArrowStepDirection) => {
        glideTime.commitValue(clamp(
            glideTime.value + (direction * GLIDE_TIME_STEP_SECONDS),
            GLIDE_TIME_MIN_SECONDS,
            GLIDE_TIME_MAX_SECONDS,
        ));
    }, [glideTime]);

    const keyboardRouting = useSynthKeyboardRouting({
        keyboardRef,
        onStepWavetable: handleStepWavetable,
        onStepPlayMode: handleStepPlayMode,
        onStepMsegRate: handleStepMsegRate,
        onStepGlideTime: handleStepGlideTime,
        onKeyboardOctaveDown,
        onKeyboardOctaveUp,
        keyboardInputMode,
        onPreviewNoteOn: (noteNumber) => {
            const safeNote = clamp(Math.round(noteNumber), 0, 127);
            lastPlayedNoteRef.current = safeNote;
            setLastPlayedNote(safeNote);
        },
        onPreviewMidiEvent: trackIntentionalNoteInput,
        sendMIDIInputEvent: patchConnection.sendMIDIInputEvent?.bind(patchConnection),
    });

    return {
        frames,
        catalogError,
        frameError,
        observedPosition,
        topStatus,
        failureDetail,
        runtimePresentation,
        displayedTableIndex: presentedTableIndex,
        displayedTableName: displayedTable?.name ?? "Factory bank",
        displayedFrameCount,
        desiredTableIndex,
        desiredTableName: desiredTable?.name ?? displayedTable?.name ?? "Factory bank",
        tableOptions: catalog?.tables ?? [],
        canRetryDesiredTableLoad: runtimePresentation.isRetryableFailure,
        wavetablePosition,
        playMode,
        glideTime,
        pan,
        oscillatorOctave,
        oscillatorSemitone,
        oscillatorFineCents,
        oscillatorVolumeDb,
        oscillatorMute,
        oscillatorSolo,
        warpMode,
        warpAmount,
        filterMode,
        filterCutoff,
        filterQ,
        filterMix,
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
        selectedMsegMorph,
        selectedMsegRate,
        distortionMode,
        distortionDriveDb,
        distortionKnee,
        distortionWet,
        distortionWetHPHz,
        distortionWetLPHz,
        distortionType,
        chorusMix,
        chorusMotionMode,
        chorusBloomMode,
        chorusTone,
        chorusFeedback,
        chorusRingAmount,
        chorusRingOffsetMode,
        chorusRingFineSemitones,
        observedFilterState,
        observedFilterSpectrum,
        observedDistortionHistory,
        observedDistortionScope,
        observedMsegPlayhead,
        observedWarpState,
        observedUnisonState,
        modulationState,
        articulationBank,
        articulationSlots,
        selectedArticulationSlot,
        selectedArticulationIsDirty,
        presetStoredStateAdapters,
        articulationHeldInput,
        discardedArticulationEdit: discardedArticulationEdit
            ? {
                slotId: discardedArticulationEdit.slotId,
                slotName: discardedArticulationEdit.slotName,
            }
            : null,
        hasHydratedArticulations: articulationBankState.hasHydrated,
        selectedMsegSlot,
        selectedEnvelopeSlot,
        selectedEnvelope,
        routes,
        msegState,
        handleSelectMsegSlot,
        handleSelectMsegShape,
        handleSelectEnvelopeSlot,
        handleEnvelopeChange,
        handleAddRoute,
        handleAddRouteWithOverrides,
        handleRemoveRoute,
        handleRouteChange,
        handleAddArticulationSlot,
        handleCaptureArticulationSlot,
        handleSelectArticulationSlot,
        handleUpdateSelectedArticulationSlot,
        handleRevertSelectedArticulationSlot,
        handleUndoDiscardedArticulationEdit,
        handleSetArticulationTriggerMode,
        handleAssignArticulationRangePosition,
        handleInsertArticulationRangeAtPosition,
        handleDuplicateAndAssignArticulationRangePosition,
        handleMoveArticulationRangeAssignment,
        handleResizeArticulationRangeAssignment,
        handleClearArticulationRangeAssignment,
        handleClearArticulationTriggerAssignments,
        handleDistributeArticulationRanges,
        handleRenameArticulationSlot,
        handleDuplicateArticulationSlot,
        handleDeleteArticulationSlot,
        handleReplaceArticulationSlotWithCurrent,
        handleStartArticulationAudition,
        handleStopArticulationAudition,
        handleStartNoteKeyAudition,
        handleStopNoteKeyAudition,
        /** Feed one user-intentional MIDI note into last-played/held bookkeeping. */
        trackIntentionalNoteInput,
        lastPlayedNote,
        handleSelectWavetable,
        handlePrewarmWavetablePicker,
        handleRetryLoad,
        handleMsegMorphChange,
        handleMsegRateChange,
        handleToggleMsegLoop,
        stageBindings,
        msegEditor,
        keyboardRouting,
    };
}
