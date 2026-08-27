import {
    memo,
    useCallback,
    useEffect,
    useMemo,
    useRef,
    useState,
    type CSSProperties,
    type PointerEvent as ReactPointerEvent,
    type RefObject,
} from "react";

import {
    PatchConnectionProvider,
    type PatchConnectionLike,
} from "../shared/cmajor-react";
import type { ResourceClient } from "../shared/resource-client";
import {
    EditableMsegSurface,
    ModulationAmountField,
    MsegPreview,
    VOICE_MODE_OPTIONS,
} from "../shared/synth-components";
import { DistortionVisualizer } from "../shared/distortion-visualizer";
import {
    clampMsegRateSeconds,
    MSEG_RATE_MAX_SECONDS,
    MSEG_RATE_MIN_SECONDS,
    type MsegSurfaceOrientation,
} from "../shared/mseg";
import {
    MODULATION_SOURCE_OPTIONS,
    applyModulationSourceOption,
    MODULATION_ENV_SLOT_COUNT,
    MODULATION_MSEG_SLOT_COUNT,
    getModulationSourceOptionValue,
    type ModulationRoute,
    type ModulationRouteUpdate,
} from "../shared/modulation";
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
    useLaneKeyTrackControlBinding,
    usePatchModulationTargetOptions,
    type LaneKeyTrackControlBinding,
} from "../shared/lane-param-bindings";
import { getModulationTargetDisplayLabel } from "../shared/target-descriptor";
import {
    presentRouteWithCanonicalAmount,
    useModulationRouteAmountBinding,
} from "../shared/modulation-route-amount";
import { findRackModulationSource } from "../shared/rack-modulation-sources";
import type { PatchControlBinding } from "../shared/patch-controls";
import {
    formatParameterEntry,
    parameterEntrySpecForFrequency,
    parameterEntrySpecForKeyTrackModulationAmount,
    parameterEntrySpecForKeyTrackOffset,
    parameterEntrySpecForRackParameter,
    parameterEntrySpecForScalar,
    parameterEntrySpecForSeconds,
} from "../shared/parameter-value-entry";
import {
    MobileVoiceFocusedEditor,
    MOBILE_VOICE_OWNER_ACCENT,
    type MobileVoiceArmedSource,
    type MobileVoiceEditorBindings,
} from "../shared/mobile-voice-editor";
import { ParameterHudLayerContext } from "../shared/parameter-hud";
import {
    ParameterMenuContext,
    useLongPressParameterMenu,
    useParameterMenu,
    type ParameterMenuRequest,
} from "../shared/parameter-context-menu";
import { useParameterMenuShell } from "../shared/parameter-menu-shell";
import {
    clampDisplayPosition,
} from "../shared/runtime-table-state";
import {
    useSynthPatchViewModel,
    useOscillatorSelectionViewModel,
    type SynthCallbackControlReadiness,
} from "../shared/synth-hooks";
import {
    IOSKeyboardDock,
    type IOSPianoKeyboardElement,
} from "./ios-keyboard-adapter";
import {
    ModulatedParameterKnob,
    type ParameterKnobDescriptor,
} from "../desktop/rack-parameter-knob";
import {
    getRackParameterDescriptor,
    type RackParameterDescriptor,
} from "../shared/rack-parameter-descriptors";
import { requireKeyTrackRange } from "../shared/key-track";

const NOTE_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
const KEYBOARD_ROOT_NOTE_DEFAULT = 36;
const AMP_ENVELOPE_EDITOR_SLOT_INDEX = MODULATION_ENV_SLOT_COUNT;
const ENVELOPE_EDITOR_SLOT_COUNT = MODULATION_ENV_SLOT_COUNT + 1;
const KEYBOARD_ROOT_NOTE_MIN = 12;
const KEYBOARD_ROOT_NOTE_MAX = 72;
const DISTORTION_WET_HP_MIN_HZ = 20;
const DISTORTION_WET_HP_MAX_HZ = 4_000;
const DISTORTION_WET_LP_MIN_HZ = 20;
const DISTORTION_WET_LP_MAX_HZ = 20_000;
function requireIOSRackParameterDescriptor(endpointID: string): RackParameterDescriptor {
    const descriptor = getRackParameterDescriptor(endpointID);
    if (descriptor === null) {
        throw new Error(`Missing iPhone rack parameter descriptor: ${endpointID}`);
    }
    return descriptor;
}
const DISTORTION_WET_HP_DESCRIPTOR = requireIOSRackParameterDescriptor("distortionWetHPHz");
const DISTORTION_WET_LP_DESCRIPTOR = requireIOSRackParameterDescriptor("distortionWetLPHz");
const IOS_DISTORTION_KEY_TRACK_RANGE = requireKeyTrackRange("filter-frequency");
const IOS_PERCENT_ENTRY_SPEC = parameterEntrySpecForScalar({
    min: 0,
    max: 1,
    step: 0,
    unit: "%",
    canonicalPerDisplayedUnit: 0.01,
    digits: 0,
});
const IOS_GLOBAL_TUNE_ENTRY_SPEC = parameterEntrySpecForScalar({
    min: GLOBAL_TUNE_MIN_SEMITONES,
    max: GLOBAL_TUNE_MAX_SEMITONES,
    step: GLOBAL_TUNE_STEP_SEMITONES,
    unit: "st",
    digits: 2,
});
const IOS_GLOBAL_TUNE_KNOB_DESCRIPTOR: ParameterKnobDescriptor = Object.freeze({
    endpointID: GLOBAL_TUNE_ENDPOINT_ID,
    label: "Global Tune",
    shortLabel: "Global Tune",
    min: GLOBAL_TUNE_MIN_SEMITONES,
    max: GLOBAL_TUNE_MAX_SEMITONES,
    initial: GLOBAL_TUNE_INITIAL_SEMITONES,
    step: GLOBAL_TUNE_STEP_SEMITONES,
    scale: "linear",
});
const IOS_FREQUENCY_ENTRY_SPEC = parameterEntrySpecForFrequency({
    minHz: DISTORTION_WET_HP_MIN_HZ,
    maxHz: DISTORTION_WET_LP_MAX_HZ,
    stepHz: 0,
    allowLogPercent: false,
});
const DISTORTION_MODE_OPTIONS = [
    { value: 0, label: "Classic", summary: "Dry/wet crossfade" },
    { value: 1, label: "Harmonics", summary: "Dry plus residue" },
] as const;
const DISTORTION_TYPE_OPTIONS = [
    { value: 0, label: "Symmetric" },
    { value: 1, label: "Asymmetric" },
    { value: 2, label: "Wavefold" },
] as const;
function triggerIOSHaptic(style = "light") {
    const hapticTrigger = (globalThis as typeof globalThis & {
        cmaj_triggerHaptic?: (nextStyle?: string) => unknown;
    }).cmaj_triggerHaptic;
    hapticTrigger?.(style);
}

type IOSResponsiveLayout = {
    isPortrait: boolean;
    noteCount: number;
    stageMinHeight: number;
    keyboardHeight: number;
    controlHeight: number;
    keyboardNaturalNoteWidth: number;
    keyboardAccidentalWidth: number;
};


type IOSPlayPanelProps = {
    playModeValue: number;
    playModeReady: boolean;
    onPlayModeChange: (nextValue: number) => void;
    playModeFocusBindings: ReturnType<typeof useSynthPatchViewModel>["keyboardRouting"]["playModeFocusBindings"];
    glideValue: number;
    glideReady: boolean;
    onGlideChange: (nextValue: number) => void;
    glideFocusTarget: ReturnType<typeof useSynthPatchViewModel>["keyboardRouting"]["glideFocusTarget"];
    globalTune: PatchControlBinding<number>;
    routes: ReadonlyArray<ModulationRoute>;
    armedSource: MobileVoiceArmedSource;
};

function clamp(value: number, min: number, max: number) {
    return Math.min(Math.max(value, min), max);
}

function formatGlideTime(seconds: number) {
    return `${Number(seconds).toFixed(3)} s`;
}

function formatDriveDb(value: number) {
    return `${Number(value).toFixed(1)} dB`;
}

function msegRateEntrySpec(seconds: number) {
    return parameterEntrySpecForSeconds({
        minSeconds: MSEG_RATE_MIN_SECONDS,
        maxSeconds: MSEG_RATE_MAX_SECONDS,
        stepSeconds: 0.001,
        currentSeconds: clampMsegRateSeconds(seconds),
    });
}

function frequencyHzToLogNormalized(value: number, minHz: number, maxHz: number) {
    const safeValue = clamp(value, minHz, maxHz);
    return Math.log(safeValue / minHz) / Math.log(maxHz / minHz);
}

function normalizedToLogFrequencyHz(normalized: number, minHz: number, maxHz: number) {
    return minHz * Math.pow(maxHz / minHz, clamp(normalized, 0, 1));
}

function formatFrameReadout(position: number, frameCount: number) {
    const safeFrameCount = Math.max(1, frameCount);
    const frameIndex = Math.round(clampDisplayPosition(position) * Math.max(0, safeFrameCount - 1)) + 1;
    return `${String(frameIndex).padStart(2, "0")}/${String(safeFrameCount).padStart(2, "0")}`;
}

function formatKeyboardRangeLabel(rootNote: number, noteCount: number) {
    const startNote = Math.max(0, Math.round(Number(rootNote) || 0));
    const lastNote = startNote + Math.max(0, Math.round(Number(noteCount) || 0) - 1);
    const formatNote = (noteNumber: number) => `${NOTE_NAMES[noteNumber % 12]}${Math.floor(noteNumber / 12) - 1}`;

    return `${formatNote(startNote)} - ${formatNote(lastNote)}`;
}

function formatIOSFactoryLibraryLoadMessage(prefix: string, detail: string) {
    return `${prefix}: ${detail}. Import the factory wavetable zip from the native library bar, then reopen the patch.`;
}

function computeIOSResponsiveLayout(width: number, height: number): IOSResponsiveLayout {
    const safeWidth = Math.max(Number(width) || 0, 0);
    const safeHeight = Math.max(Number(height) || 0, 0);
    const isPortrait = safeHeight > safeWidth;
    const shortLandscape = safeHeight < 460;
    const compact = safeWidth < 760;

    return {
        isPortrait,
        noteCount: 18,
        stageMinHeight: compact ? 216 : (shortLandscape ? 180 : 252),
        controlHeight: shortLandscape ? 48 : 54,
        keyboardHeight: compact ? 94 : (shortLandscape ? 88 : 102),
        keyboardNaturalNoteWidth: compact ? 22 : (shortLandscape ? 20 : 24),
        keyboardAccidentalWidth: compact ? 12 : (shortLandscape ? 11 : 13),
    };
}

function useIOSViewportLayout() {
    const [layout, setLayout] = useState(() => computeIOSResponsiveLayout(
        Number(globalThis.visualViewport?.width) || Number(globalThis.window?.innerWidth) || 390,
        Number(globalThis.visualViewport?.height) || Number(globalThis.window?.innerHeight) || 844,
    ));

    useEffect(() => {
        const update = () => {
            setLayout(computeIOSResponsiveLayout(
                Number(globalThis.visualViewport?.width) || Number(globalThis.window?.innerWidth) || 390,
                Number(globalThis.visualViewport?.height) || Number(globalThis.window?.innerHeight) || 844,
            ));
        };

        globalThis.visualViewport?.addEventListener?.("resize", update);
        globalThis.window?.addEventListener?.("resize", update);
        update();

        return () => {
            globalThis.visualViewport?.removeEventListener?.("resize", update);
            globalThis.window?.removeEventListener?.("resize", update);
        };
    }, []);

    return layout;
}

function arePlayPanelPropsEqual(previousProps: IOSPlayPanelProps, nextProps: IOSPlayPanelProps) {
    return previousProps.playModeValue === nextProps.playModeValue
        && previousProps.playModeReady === nextProps.playModeReady
        && previousProps.onPlayModeChange === nextProps.onPlayModeChange
        && previousProps.playModeFocusBindings.onPointerDownCapture === nextProps.playModeFocusBindings.onPointerDownCapture
        && previousProps.playModeFocusBindings.onFocusCapture === nextProps.playModeFocusBindings.onFocusCapture
        && previousProps.glideValue === nextProps.glideValue
        && previousProps.glideReady === nextProps.glideReady
        && previousProps.onGlideChange === nextProps.onGlideChange
        && previousProps.glideFocusTarget.onActivate === nextProps.glideFocusTarget.onActivate
        && previousProps.glideFocusTarget.onBeginTextEntry === nextProps.glideFocusTarget.onBeginTextEntry
        && previousProps.glideFocusTarget.onEndTextEntry === nextProps.glideFocusTarget.onEndTextEntry
        && previousProps.globalTune.value === nextProps.globalTune.value
        && previousProps.globalTune.isReady === nextProps.globalTune.isReady
        && previousProps.globalTune.commitValue === nextProps.globalTune.commitValue
        && previousProps.routes === nextProps.routes
        && previousProps.armedSource.sourceKind === nextProps.armedSource.sourceKind
        && previousProps.armedSource.sourceSlot === nextProps.armedSource.sourceSlot;
}

function IOSGlobalTuneKnob({
    binding,
    routes,
    armedSource,
}: {
    binding: PatchControlBinding<number>;
    routes: ReadonlyArray<ModulationRoute>;
    armedSource: MobileVoiceArmedSource;
}) {
    const route = routes.find((candidate) => (
        candidate.targetKind === GLOBAL_TUNE_TARGET_KIND
        && candidate.sourceKind === armedSource.sourceKind
        && candidate.sourceSlot === armedSource.sourceSlot
    )) ?? null;
    const amountBinding = useModulationRouteAmountBinding(route);
    const presentedRoute = presentRouteWithCanonicalAmount(route, amountBinding);
    const sourceDescriptor = findRackModulationSource(armedSource.sourceKind, armedSource.sourceSlot);
    const openParameterMenu = useParameterMenu();

    return (
        <div className="ios-global-tune-field global-tune-knob-cell">
            <ModulatedParameterKnob
                descriptor={IOS_GLOBAL_TUNE_KNOB_DESCRIPTOR}
                binding={binding}
                modulationApplication="linear"
                modulationTargetKind={GLOBAL_TUNE_TARGET_KIND}
                formatValue={formatSemitonesAndCents}
                ownerAccent={MOBILE_VOICE_OWNER_ACCENT}
                route={presentedRoute}
                sourceIsSelected
                sourceAccent={sourceDescriptor.accent}
                effectiveness="active"
                dataRole="ios-global-tune-knob"
                trackDataRole="ios-global-tune-knob-track"
                handleDataRole="ios-global-tune-knob-handle"
                onSelect={() => {}}
                onModulationAmountChange={amountBinding.setValue}
                onRequestContextMenu={(clientX, clientY) => {
                    openParameterMenu?.({
                        controlKey: GLOBAL_TUNE_ENDPOINT_ID,
                        label: "Global Tune",
                        targetKind: GLOBAL_TUNE_TARGET_KIND,
                        baseSpec: IOS_GLOBAL_TUNE_ENTRY_SPEC,
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

const IOSPlayPanel = memo(function IOSPlayPanel({
    playModeValue,
    playModeReady,
    onPlayModeChange,
    playModeFocusBindings,
    glideValue,
    glideReady,
    onGlideChange,
    glideFocusTarget,
    globalTune,
    routes,
    armedSource,
}: IOSPlayPanelProps) {
    return (
        <div className="play-panel ios-section-panel" data-section-accent="lime" data-liquid-detail="section-tab">
            <div className="play-grid">
                <label className="play-field" aria-label="Voice mode">
                    <select
                        className="play-select play-mode-select"
                        aria-label="Voice mode"
                        value={String(playModeValue)}
                        disabled={!playModeReady}
                        data-host-state={playModeReady ? "ready" : "loading"}
                        onChange={(event) => onPlayModeChange(Number(event.target.value))}
                        {...playModeFocusBindings}
                    >
                        {VOICE_MODE_OPTIONS.map((option) => (
                            <option key={option.value} value={option.value}>{option.label}</option>
                        ))}
                    </select>
                </label>
                <IOSGlobalTuneKnob binding={globalTune} routes={routes} armedSource={armedSource} />
                <label className="play-field" aria-label="Glide time">
                    <div className="glide-field-body">
                        <input
                            className="glide-time-slider"
                            type="range"
                            min="0"
                            max="1"
                            step="0.001"
                            value={Math.min(glideValue, 1).toFixed(3)}
                            disabled={!glideReady}
                            data-host-state={glideReady ? "ready" : "loading"}
                            aria-label="Glide time"
                            onPointerDownCapture={glideFocusTarget.onActivate}
                            onFocusCapture={glideFocusTarget.onActivate}
                            onChange={(event) => onGlideChange(Number(event.target.value))}
                        />
                        <div className="glide-time-readout" data-role="glide-time-readout">
                            {formatGlideTime(glideValue)}
                        </div>
                    </div>
                </label>
            </div>
        </div>
    );
}, arePlayPanelPropsEqual);

const IOSMsegLauncher = memo(function IOSMsegLauncher({
    msegState,
    observedMsegPlayhead,
    selectedMsegSlot,
    selectedMsegMorph,
    previewOrientation,
    onOpenEditor,
    onToggleLoop,
    onSelectMsegShape,
    onMsegMorphChange,
    panBinding,
    onSelectMsegSlot,
}: {
    msegState: ReturnType<typeof useSynthPatchViewModel>["msegState"];
    observedMsegPlayhead: ReturnType<typeof useSynthPatchViewModel>["observedMsegPlayhead"];
    selectedMsegSlot: number;
    selectedMsegMorph: ReturnType<typeof useSynthPatchViewModel>["selectedMsegMorph"];
    previewOrientation: MsegSurfaceOrientation;
    onOpenEditor: () => void;
    onToggleLoop: () => void;
    onSelectMsegShape: (shapeIndex: number) => void;
    onMsegMorphChange: (nextValue: number) => void;
    panBinding: PatchControlBinding<number>;
    onSelectMsegSlot: (slotIndex: number) => void;
}) {
    return (
        <div className="mseg-shell ios-section-panel" data-section-accent="mint" data-liquid-detail="routing-node">
            <div className="mseg-launcher">
                <div className="mseg-launcher-head">
                    <div className="mseg-launcher-copy">
                        <div className="mseg-eyebrow">{`MSEG ${selectedMsegSlot + 1}`}</div>
                        <strong className="mseg-route-title">Modulation Shape</strong>
                    </div>
                </div>

                <div style={{ display: "flex", gap: "0.5rem", marginBottom: "0.75rem" }}>
                    {Array.from({ length: MODULATION_MSEG_SLOT_COUNT }, (_, slotIndex) => (
                        <button
                            key={`ios-mseg-slot-${slotIndex + 1}`}
                            type="button"
                            aria-label={`Select MSEG ${slotIndex + 1}`}
                            onClick={() => onSelectMsegSlot(slotIndex)}
                            style={{
                                borderRadius: "999px",
                                border: "1px solid rgba(255,255,255,0.1)",
                                padding: "0.35rem 0.8rem",
                                background: selectedMsegSlot === slotIndex ? "rgba(88, 234, 208, 0.18)" : "rgba(255,255,255,0.04)",
                                color: "rgba(240,248,255,0.92)",
                                fontSize: "0.7rem",
                                letterSpacing: "0.14em",
                                textTransform: "uppercase",
                            }}
                        >
                            {slotIndex + 1}
                        </button>
                    ))}
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "auto minmax(0, 1fr)", gap: "0.75rem", alignItems: "center", marginBottom: "0.75rem" }}>
                    <div style={{ display: "flex", gap: "0.35rem" }}>
                        {[0, 1].map((shapeIndex) => (
                            <button
                                key={`ios-mseg-shape-${shapeIndex}`}
                                type="button"
                                aria-label={`Edit MSEG shape ${shapeIndex === 0 ? "A" : "B"}`}
                                aria-pressed={msegState?.editShapeIndex === shapeIndex}
                                onClick={() => onSelectMsegShape(shapeIndex)}
                                style={{
                                    borderRadius: "0.55rem",
                                    border: "1px solid rgba(255,255,255,0.1)",
                                    padding: "0.35rem 0.6rem",
                                    background: msegState?.editShapeIndex === shapeIndex ? "rgba(88, 234, 208, 0.18)" : "rgba(255,255,255,0.04)",
                                    color: "rgba(240,248,255,0.92)",
                                    fontSize: "0.7rem",
                                    fontWeight: 700,
                                }}
                            >
                                {shapeIndex === 0 ? "A" : "B"}
                            </button>
                        ))}
                    </div>
                    <label className="mseg-rate">
                        <span className="mseg-depth-label">Morph</span>
                        <input
                            className="mseg-rate-slider"
                            type="range"
                            aria-label="MSEG morph"
                            data-role="mseg-morph-slider"
                            data-modulation-target-kind={`mseg${selectedMsegSlot + 1}Morph`}
                            min="0"
                            max="1"
                            step="0.001"
                            value={selectedMsegMorph.value.toFixed(3)}
                            disabled={!selectedMsegMorph.isReady}
                            data-host-state={selectedMsegMorph.isReady ? "ready" : "loading"}
                            onChange={(event) => onMsegMorphChange(Number(event.currentTarget.value))}
                        />
                    </label>
                </div>

                <button
                    className="mseg-preview-button"
                    type="button"
                    aria-label="Open MSEG editor"
                    onClick={onOpenEditor}
                >
                    <div className="mseg-preview-shell">
                        {msegState ? (
                            <MsegPreview
                                points={msegState.shape.points}
                                orientation={previewOrientation}
                                className="h-full w-full overflow-hidden rounded-[20px] bg-white/[0.03]"
                                progressFillEnd={observedMsegPlayhead.progressFillEnd}
                            />
                        ) : null}
                    </div>
                </button>

                <div className="mseg-preview-footer">
                    <div className="mseg-launcher-rate-readout" data-role="mseg-launcher-rate-readout">
                        {msegState
                            ? formatParameterEntry(
                                msegRateEntrySpec(msegState.playback.rate.seconds),
                                msegState.playback.rate.seconds,
                            ).display
                            : formatParameterEntry(msegRateEntrySpec(1), 1).display}
                    </div>
                    <button
                        className="mseg-loop-button mseg-launcher-loop-button"
                        type="button"
                        data-role="mseg-launcher-loop-button"
                        aria-pressed={msegState?.playback.loop ? "true" : "false"}
                        aria-label="Toggle full-shape loop"
                        onClick={onToggleLoop}
                    >
                        Loop
                    </button>
                </div>

                <div className="mseg-controls">
                    <label className="mseg-depth">
                        <span className="mseg-depth-label">Pan</span>
                        <input
                            className="mseg-depth-slider"
                            data-role="oscillator-pan-slider"
                            aria-label="Oscillator pan"
                            type="range"
                            min="-1"
                            max="1"
                            step="0.001"
                            value={Number(panBinding.value).toFixed(3)}
                            disabled={!panBinding.isReady}
                            data-host-state={panBinding.isReady ? "ready" : "loading"}
                            onChange={(event) => panBinding.commitValue(Number(event.target.value))}
                        />
                    </label>
                    <div className="mseg-depth-readout">
                        {Number(panBinding.value).toFixed(3)}
                    </div>
                </div>
            </div>
        </div>
    );
});

const IOSKeyboardToolbar = memo(function IOSKeyboardToolbar({
    keyboardRootLabel,
    canOctaveDown,
    canOctaveUp,
    onOctaveDown,
    onOctaveUp,
}: {
    keyboardRootLabel: string;
    canOctaveDown: boolean;
    canOctaveUp: boolean;
    onOctaveDown: () => void;
    onOctaveUp: () => void;
}) {
    return (
        <div className="keyboard-toolbar ios-section-panel" data-section-accent="lime" data-liquid-detail="edge-rail">
            <div className="octave-controls">
                <button
                    className="octave-button octave-down"
                    type="button"
                    disabled={!canOctaveDown}
                    onClick={onOctaveDown}
                >
                    Oct -
                </button>
                <div className="octave-readout" data-role="octave-readout">
                    {keyboardRootLabel}
                </div>
                <button
                    className="octave-button octave-up"
                    type="button"
                    disabled={!canOctaveUp}
                    onClick={onOctaveUp}
                >
                    Oct +
                </button>
            </div>
        </div>
    );
});

const IOSModulationRouteAmountField = memo(function IOSModulationRouteAmountField({
    route,
    routeIndex,
    onRouteChange,
}: {
    route: ModulationRoute;
    routeIndex: number;
    onRouteChange: (routeIndex: number, update: ModulationRouteUpdate) => void;
}) {
    const amountBinding = useModulationRouteAmountBinding(route);

    return (
        <ModulationAmountField
            targetKind={route.targetKind}
            polarity={route.polarity}
            amount={amountBinding.value}
            onPolarityChange={(nextPolarity) => {
                onRouteChange(routeIndex, { polarity: nextPolarity });
            }}
            knobAriaLabel={`Route ${routeIndex + 1} depth`}
            polarityAriaLabel={`Route ${routeIndex + 1} polarity`}
            onChange={amountBinding.setValue}
        />
    );
});

const IOSModulationMatrixPanel = memo(function IOSModulationMatrixPanel({
    selectedEnvelopeSlot,
    selectedEnvelope,
    envelopeReadiness,
    routes,
    onSelectEnvelopeSlot,
    onEnvelopeChange,
    onAddRoute,
    onRemoveRoute,
    onRouteChange,
}: {
    selectedEnvelopeSlot: number;
    selectedEnvelope: ReturnType<typeof useSynthPatchViewModel>["selectedEnvelope"];
    envelopeReadiness: SynthCallbackControlReadiness["envelope"];
    routes: ReturnType<typeof useSynthPatchViewModel>["routes"];
    onSelectEnvelopeSlot: (slotIndex: number) => void;
    onEnvelopeChange: (field: "attackSeconds" | "decaySeconds" | "sustain" | "releaseSeconds", nextValue: number) => void;
    onAddRoute: () => void;
    onRemoveRoute: (routeIndex: number) => void;
    onRouteChange: (routeIndex: number, update: ModulationRouteUpdate) => void;
}) {
    const targetOptions = usePatchModulationTargetOptions();
    return (
        <div
            className="ios-section-panel"
            data-section-accent="amber"
            data-liquid-detail="edge-rail"
        >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "0.75rem" }}>
                <div>
                    <div className="mseg-eyebrow">Envelopes + Routes</div>
                    <strong className="mseg-route-title">Modulation Matrix</strong>
                </div>
            </div>

            <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
                {Array.from({ length: ENVELOPE_EDITOR_SLOT_COUNT }, (_, slotIndex) => (
                    <button
                        key={`ios-env-slot-${slotIndex + 1}`}
                        type="button"
                        aria-label={slotIndex === AMP_ENVELOPE_EDITOR_SLOT_INDEX
                            ? "Select Amp Envelope"
                            : `Select envelope ${slotIndex + 1}`}
                        onClick={() => onSelectEnvelopeSlot(slotIndex)}
                        style={{
                            borderRadius: "999px",
                            border: "1px solid rgba(255,255,255,0.1)",
                            padding: "0.35rem 0.8rem",
                            background: selectedEnvelopeSlot === slotIndex ? "rgba(52, 211, 153, 0.2)" : "rgba(255,255,255,0.04)",
                            color: "rgba(240,248,255,0.92)",
                            fontSize: "0.7rem",
                            letterSpacing: "0.14em",
                            textTransform: "uppercase",
                        }}
                    >
                        {slotIndex === AMP_ENVELOPE_EDITOR_SLOT_INDEX
                            ? "Amp Envelope"
                            : `Env ${slotIndex + 1}`}
                    </button>
                ))}
            </div>

            <div style={{ display: "grid", gap: "0.75rem" }}>
                {[
                    ["attackSeconds", "Attack", "Attack", 0.001, 10, 0.001, Number(selectedEnvelope?.attackSeconds ?? 0.01)],
                    ["decaySeconds", "Decay", "Decay", 0.001, 10, 0.001, Number(selectedEnvelope?.decaySeconds ?? 0.25)],
                    ["sustain", "Sustain", "Sustain", 0, 1, 0.001, Number(selectedEnvelope?.sustain ?? 0.5)],
                    ["releaseSeconds", "Release", "Release", selectedEnvelopeSlot === AMP_ENVELOPE_EDITOR_SLOT_INDEX ? 0.005 : 0.001, 10, 0.001, Number(selectedEnvelope?.releaseSeconds ?? 0.2)],
                ].map(([field, label, target, min, max, step, value]) => (
                    <label key={String(field)} style={{ display: "grid", gap: "0.35rem" }}>
                        <span className="mseg-depth-label">{String(label)}</span>
                        <input
                            className="mseg-rate-slider"
                            type="range"
                            data-modulation-target-kind={selectedEnvelopeSlot === AMP_ENVELOPE_EDITOR_SLOT_INDEX
                                ? `amp${target}`
                                : `env${selectedEnvelopeSlot + 1}${target}`}
                            min={String(min)}
                            max={String(max)}
                            step={String(step)}
                            value={Number(value).toFixed(3)}
                            disabled={!envelopeReadiness[field as keyof typeof envelopeReadiness]}
                            data-host-state={envelopeReadiness[field as keyof typeof envelopeReadiness] ? "ready" : "loading"}
                            onChange={(event) => onEnvelopeChange(field as "attackSeconds" | "decaySeconds" | "sustain" | "releaseSeconds", Number(event.target.value))}
                        />
                    </label>
                ))}
            </div>

            <div style={{ display: "grid", gap: "0.75rem" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "0.75rem" }}>
                    <div className="mseg-depth-label">Route Rows</div>
                    <button className="mseg-loop-button" type="button" aria-label="Add route" onClick={onAddRoute}>Add Route</button>
                </div>
                {routes.map((route, routeIndex) => {
                    return (
                        <div
                            key={route.id}
                            style={{
                                display: "grid",
                                gap: "0.5rem",
                                gridTemplateColumns: "minmax(0,1fr) minmax(0,1fr) auto auto",
                                alignItems: "center",
                                borderRadius: "18px",
                                border: "1px solid rgba(255,255,255,0.08)",
                                padding: "0.75rem",
                                background: "rgba(0,0,0,0.16)",
                            }}
                        >
                            <select
                                aria-label={`Route ${routeIndex + 1} source`}
                                value={getModulationSourceOptionValue(route)}
                                onChange={(event) => {
                                    const nextSource = applyModulationSourceOption(route, event.target.value);
                                    onRouteChange(routeIndex, {
                                        sourceKind: nextSource.sourceKind,
                                        sourceSlot: nextSource.sourceSlot,
                                    });
                                }}
                            >
                                {MODULATION_SOURCE_OPTIONS.map((option) => (
                                    <option key={option.value} value={option.value}>{option.label}</option>
                                ))}
                            </select>
                            <select
                                aria-label={`Route ${routeIndex + 1} target`}
                                value={route.targetKind}
                                onChange={(event) => {
                                    const nextTargetKind = event.target.value;
                                    onRouteChange(routeIndex, {
                                        targetKind: nextTargetKind as ModulationRoute["targetKind"],
                                    });
                                }}
                            >
                                {(targetOptions.some((option) => option.value === route.targetKind)
                                    ? targetOptions
                                    : [...targetOptions, {
                                        value: route.targetKind,
                                        label: getModulationTargetDisplayLabel(route.targetKind),
                                    }]
                                ).map((option) => (
                                    <option key={option.value} value={option.value}>{option.label}</option>
                                ))}
                            </select>
                            <IOSModulationRouteAmountField
                                route={route}
                                routeIndex={routeIndex}
                                onRouteChange={onRouteChange}
                            />
                            <button
                                className="mseg-loop-button"
                                type="button"
                                aria-label={`Remove route ${routeIndex + 1}`}
                                onClick={() => onRemoveRoute(routeIndex)}
                            >
                                x
                            </button>
                        </div>
                    );
                })}
                <div style={{
                    color: "rgba(226,232,240,0.58)",
                    fontSize: "0.72rem",
                    lineHeight: 1.45,
                }}
                >
                    Depth shows the movement this row asks for at full source. Position, warp, cutoff, Q, amp, and pan still stop at the synth&apos;s real limits.
                </div>
            </div>
        </div>
    );
});

function IOSDistortionTrackedFrequencyField({
    descriptor,
    keyTrack,
    otherOrdinaryHz,
    role,
    isHighPass,
}: {
    descriptor: RackParameterDescriptor;
    keyTrack: LaneKeyTrackControlBinding;
    otherOrdinaryHz: number;
    role: "distortion-wet-hp-slider" | "distortion-wet-lp-slider";
    isHighPass: boolean;
}) {
    const openParameterMenu = useParameterMenu();
    const targetKind = `lane.distortion#1.${descriptor.endpointID}`;
    const buildMenuRequest = useCallback((): Omit<ParameterMenuRequest, "clientX" | "clientY"> => ({
        controlKey: descriptor.endpointID,
        label: keyTrack.enabled ? "Key Track Offset" : descriptor.label,
        targetKind,
        baseSpec: keyTrack.enabled
            ? parameterEntrySpecForKeyTrackOffset("filter-frequency")
            : parameterEntrySpecForRackParameter(descriptor, keyTrack.binding.value),
        amountSpec: keyTrack.enabled
            ? parameterEntrySpecForKeyTrackModulationAmount("filter-frequency", "octaves")
            : undefined,
        baseFieldLabel: keyTrack.enabled ? "Key Track Offset" : undefined,
        routeDestinationLabel: keyTrack.enabled ? "Key Track Offset" : undefined,
        baseValue: keyTrack.binding.value,
        defaultValue: keyTrack.enabled ? 0 : descriptor.initial,
        commitBase: keyTrack.binding.commitValue,
    }), [descriptor, keyTrack.binding, keyTrack.enabled, targetKind]);
    const longPressProps = useLongPressParameterMenu(buildMenuRequest);
    const displayedValue = keyTrack.binding.value;
    const normalizedValue = keyTrack.enabled
        ? (displayedValue - IOS_DISTORTION_KEY_TRACK_RANGE.knobMin)
            / (IOS_DISTORTION_KEY_TRACK_RANGE.knobMax - IOS_DISTORTION_KEY_TRACK_RANGE.knobMin)
        : frequencyHzToLogNormalized(displayedValue, descriptor.min, descriptor.max);
    const displayedLabel = keyTrack.enabled ? "Key Track Offset" : descriptor.shortLabel === "HP" ? "Band HP" : "Band LP";
    const displayedReadout = keyTrack.enabled
        ? `${Number(displayedValue.toFixed(2))} st`
        : formatParameterEntry(IOS_FREQUENCY_ENTRY_SPEC, displayedValue).display;

    return (
        <label style={{ display: "grid", gap: "0.32rem" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "0.75rem" }}>
                <span className="mseg-depth-label">{displayedLabel}</span>
                <div style={{ display: "flex", alignItems: "center", gap: "0.45rem" }}>
                    <span style={{
                        fontFamily: "\"SF Mono\", Menlo, monospace",
                        fontSize: "0.72rem",
                        letterSpacing: "0.08em",
                        color: "rgba(226,232,240,0.92)",
                    }}
                    >
                        {displayedReadout}
                    </span>
                    <button
                        type="button"
                        className="key-track-button ios-key-track-button"
                        style={{ ["--key-track-accent" as string]: "#fb7185" }}
                        aria-pressed={keyTrack.enabled}
                        onClick={(event) => {
                            event.preventDefault();
                            keyTrack.setEnabled(!keyTrack.enabled);
                        }}
                    >Key Track</button>
                </div>
            </div>
            <input
                {...longPressProps}
                data-role={role}
                className="mseg-rate-slider"
                type="range"
                min="0"
                max="1"
                step="0.001"
                value={clamp(normalizedValue, 0, 1).toFixed(3)}
                aria-label={keyTrack.enabled ? "Key Track Offset" : descriptor.label}
                onContextMenu={(event) => {
                    if (openParameterMenu === null) return;
                    event.preventDefault();
                    openParameterMenu({
                        ...buildMenuRequest(),
                        clientX: event.clientX,
                        clientY: event.clientY,
                    });
                }}
                onChange={(event) => {
                    const normalized = Number(event.target.value);
                    if (keyTrack.enabled) {
                        keyTrack.binding.commitValue(
                            IOS_DISTORTION_KEY_TRACK_RANGE.knobMin
                                + normalized * (IOS_DISTORTION_KEY_TRACK_RANGE.knobMax
                                    - IOS_DISTORTION_KEY_TRACK_RANGE.knobMin),
                        );
                        return;
                    }
                    const nextHz = normalizedToLogFrequencyHz(normalized, descriptor.min, descriptor.max);
                    keyTrack.binding.commitValue(isHighPass
                        ? clamp(nextHz, descriptor.min, Math.min(descriptor.max, otherOrdinaryHz))
                        : clamp(nextHz, Math.max(descriptor.min, otherOrdinaryHz), descriptor.max));
                }}
            />
        </label>
    );
}

const IOSDistortionPanel = memo(function IOSDistortionPanel({
    modeValue,
    typeValue,
    driveValue,
    kneeValue,
    wetValue,
    wetHPKeyTrack,
    wetLPKeyTrack,
    historyFrame,
    scopeFrame,
    onModeChange,
    onTypeChange,
    onDriveChange,
    onKneeChange,
    onWetChange,
}: {
    modeValue: number;
    typeValue: number;
    driveValue: number;
    kneeValue: number;
    wetValue: number;
    wetHPKeyTrack: LaneKeyTrackControlBinding;
    wetLPKeyTrack: LaneKeyTrackControlBinding;
    historyFrame: ReturnType<typeof useSynthPatchViewModel>["observedDistortionHistory"];
    scopeFrame: ReturnType<typeof useSynthPatchViewModel>["observedDistortionScope"];
    onModeChange: (nextValue: number) => void;
    onTypeChange: (nextValue: number) => void;
    onDriveChange: (nextValue: number) => void;
    onKneeChange: (nextValue: number) => void;
    onWetChange: (nextValue: number) => void;
}) {
    const inputPeak = scopeFrame?.inputPeak ?? 0;
    const outputPeak = scopeFrame?.outputPeak ?? 0;
    const removedPeak = scopeFrame?.removedPeak ?? 0;
    const overshoot = Math.max(0, inputPeak - 1);
    const headroom = Math.max(0, 1 - inputPeak);
    const modeLabel = DISTORTION_MODE_OPTIONS.find((option) => option.value === modeValue)?.label ?? "Classic";

    return (
        <div
            data-role="ios-distortion-panel"
            className="ios-section-panel"
            data-section-accent="coral"
            data-liquid-detail="meter-cover"
        >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", gap: "0.75rem" }}>
                <div>
                    <div className="mseg-eyebrow">Distortion</div>
                    <strong className="mseg-route-title">Driven Curve + Delta</strong>
                </div>
                <div style={{
                    display: "grid",
                    gap: "0.2rem",
                    textAlign: "right",
                    fontFamily: "\"SF Mono\", Menlo, monospace",
                    fontSize: "0.66rem",
                    letterSpacing: "0.14em",
                    textTransform: "uppercase",
                    color: "rgba(226,232,240,0.76)",
                }}
                >
                    <div>{overshoot > 0 ? `Ceiling +${overshoot.toFixed(2)}` : `Ceiling ${Math.round(headroom * 100)}% clear`}</div>
                    <div>{`Out ${outputPeak.toFixed(3)} • Delta ${removedPeak.toFixed(3)}`}</div>
                </div>
            </div>

            <div style={{ display: "grid", gap: "0.45rem" }}>
                <div className="mseg-depth-label">Type</div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "0.5rem" }}>
                    {DISTORTION_TYPE_OPTIONS.map((option) => {
                        const active = typeValue === option.value;

                        return (
                            <button
                                key={option.value}
                                type="button"
                                data-role={`distortion-type-option-${option.value}`}
                                aria-pressed={active ? "true" : "false"}
                                onClick={() => onTypeChange(option.value)}
                                style={{
                                    borderRadius: "16px",
                                    border: active ? "1px solid rgba(251,113,133,0.42)" : "1px solid rgba(255,255,255,0.08)",
                                    background: active ? "rgba(251,113,133,0.13)" : "rgba(255,255,255,0.04)",
                                    color: active ? "rgba(255,241,242,0.98)" : "rgba(226,232,240,0.88)",
                                    padding: "0.7rem 0.45rem",
                                    fontSize: "0.69rem",
                                    letterSpacing: "0.06em",
                                    textTransform: "uppercase",
                                }}
                            >
                                {option.label}
                            </button>
                        );
                    })}
                </div>
            </div>

            <div style={{ display: "grid", gap: "0.45rem" }}>
                <div className="mseg-depth-label">Mode</div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.5rem" }}>
                    {DISTORTION_MODE_OPTIONS.map((option) => {
                        const active = modeValue === option.value;

                        return (
                            <button
                                key={option.value}
                                type="button"
                                data-role={`distortion-mode-option-${option.value}`}
                                aria-pressed={active ? "true" : "false"}
                                onClick={() => onModeChange(option.value)}
                                style={{
                                    display: "grid",
                                    gap: "0.12rem",
                                    borderRadius: "16px",
                                    border: active ? "1px solid rgba(103,232,249,0.32)" : "1px solid rgba(255,255,255,0.08)",
                                    background: active ? "rgba(34,211,238,0.12)" : "rgba(255,255,255,0.04)",
                                    color: active ? "rgba(236,254,255,0.96)" : "rgba(226,232,240,0.88)",
                                    padding: "0.7rem 0.8rem",
                                    textAlign: "left",
                                }}
                            >
                                <span style={{ fontSize: "0.73rem", letterSpacing: "0.08em", textTransform: "uppercase" }}>{option.label}</span>
                                <span style={{ fontSize: "0.67rem", color: active ? "rgba(207,250,254,0.82)" : "rgba(203,213,225,0.62)" }}>{option.summary}</span>
                            </button>
                        );
                    })}
                </div>
            </div>

            <DistortionVisualizer
                driveDb={driveValue}
                knee={kneeValue}
                type={typeValue}
                transferFrame={scopeFrame}
                historyFrame={historyFrame}
            />

            <div style={{ display: "grid", gap: "0.8rem" }}>
                {[
                    {
                        label: "Drive",
                        value: driveValue,
                        min: 0,
                        max: 36,
                        step: 0.01,
                        readout: formatDriveDb(driveValue),
                        onChange: onDriveChange,
                        dataRole: "distortion-drive-slider",
                        readoutRole: "distortion-drive-readout",
                    },
                    {
                        label: "Knee",
                        value: kneeValue,
                        min: 0,
                        max: 1,
                        step: 0.001,
                        readout: formatParameterEntry(IOS_PERCENT_ENTRY_SPEC, kneeValue).display,
                        onChange: onKneeChange,
                        dataRole: "distortion-knee-slider",
                        readoutRole: null,
                    },
                    {
                        label: "Mix",
                        value: wetValue,
                        min: 0,
                        max: 1,
                        step: 0.001,
                        readout: formatParameterEntry(IOS_PERCENT_ENTRY_SPEC, wetValue).display,
                        onChange: onWetChange,
                        dataRole: "distortion-mix-slider",
                        readoutRole: "distortion-mix-readout",
                    },
                ].map((field) => (
                    <label key={field.label} style={{ display: "grid", gap: "0.32rem" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", gap: "0.75rem" }}>
                            <span className="mseg-depth-label">{field.label}</span>
                            <span
                                data-role={field.readoutRole ?? undefined}
                                style={{
                                    fontFamily: "\"SF Mono\", Menlo, monospace",
                                    fontSize: "0.72rem",
                                    letterSpacing: "0.08em",
                                    color: "rgba(226,232,240,0.92)",
                                }}
                            >
                                {field.readout}
                            </span>
                        </div>
                        <input
                            data-role={field.dataRole}
                            className="mseg-rate-slider"
                            type="range"
                            min={String(field.min)}
                            max={String(field.max)}
                            step={String(field.step)}
                            value={Number(field.value).toFixed(3)}
                            onChange={(event) => field.onChange(Number(event.target.value))}
                        />
                    </label>
                ))}

                <IOSDistortionTrackedFrequencyField
                    descriptor={DISTORTION_WET_HP_DESCRIPTOR}
                    keyTrack={wetHPKeyTrack}
                    otherOrdinaryHz={wetLPKeyTrack.ordinaryBinding.value}
                    role="distortion-wet-hp-slider"
                    isHighPass
                />

                <IOSDistortionTrackedFrequencyField
                    descriptor={DISTORTION_WET_LP_DESCRIPTOR}
                    keyTrack={wetLPKeyTrack}
                    otherOrdinaryHz={wetHPKeyTrack.ordinaryBinding.value}
                    role="distortion-wet-lp-slider"
                    isHighPass={false}
                />
            </div>

            <div style={{
                display: "grid",
                gap: "0.2rem",
                padding: "0.75rem 0.9rem",
                borderRadius: "18px",
                border: "1px solid rgba(251,113,133,0.12)",
                background: "rgba(251,113,133,0.05)",
                fontFamily: "\"SF Mono\", Menlo, monospace",
                fontSize: "0.7rem",
                letterSpacing: "0.1em",
                textTransform: "uppercase",
            }}
            >
                <div style={{ color: "rgba(251,191,202,0.78)" }}>{`${modeLabel} Readout`}</div>
                <div style={{ color: "rgba(241,245,249,0.9)" }}>{`Input ${inputPeak.toFixed(3)}`}</div>
                <div style={{ color: "rgba(165,243,252,0.9)" }}>{`Output ${outputPeak.toFixed(3)}`}</div>
                <div style={{ color: "rgba(251,113,133,0.9)" }}>{`Delta ${removedPeak.toFixed(3)}`}</div>
            </div>
        </div>
    );
});

const IOSMsegModal = memo(function IOSMsegModal({
    isOpen,
    onClose,
    slotLabel,
    slotIndex,
    msegState,
    selectedMsegMorph,
    surfaceRef,
    orientation,
    selectedPointIndex,
    hoveredSegmentIndex,
    activeSegmentIndex,
    onPointerDown,
    onPointerMove,
    onPointerLeave,
    onPointerUp,
    rateSeconds,
    rateReady,
    onSelectShape,
    onMorphChange,
    onRateChange,
    onToggleLoop,
    rateFocusBindings,
}: {
    isOpen: boolean;
    onClose: () => void;
    slotLabel: string;
    slotIndex: number;
    msegState: ReturnType<typeof useSynthPatchViewModel>["msegState"];
    selectedMsegMorph: ReturnType<typeof useSynthPatchViewModel>["selectedMsegMorph"];
    surfaceRef: RefObject<SVGSVGElement | null>;
    orientation: MsegSurfaceOrientation;
    selectedPointIndex: number;
    hoveredSegmentIndex: number;
    activeSegmentIndex: number;
    onPointerDown: (event: ReactPointerEvent<SVGSVGElement>) => void;
    onPointerMove: (event: ReactPointerEvent<SVGSVGElement>) => void;
    onPointerLeave: (event: ReactPointerEvent<SVGSVGElement>) => void;
    onPointerUp: (event: ReactPointerEvent<SVGSVGElement>) => void;
    rateSeconds: number;
    rateReady: boolean;
    onSelectShape: (shapeIndex: number) => void;
    onMorphChange: (nextValue: number) => void;
    onRateChange: (nextValue: number) => void;
    onToggleLoop: () => void;
    rateFocusBindings: ReturnType<typeof useSynthPatchViewModel>["keyboardRouting"]["msegRateFocusBindings"];
}) {
    return (
        <div className="mseg-modal-layer" data-role="mseg-modal-layer" data-open={isOpen ? "true" : "false"}>
            {isOpen ? (
                <section
                    className="mseg-modal ios-section-panel"
                    data-section-accent="mint"
                    data-liquid-detail="routing-node"
                    data-role="mseg-modal"
                    aria-hidden={isOpen ? "false" : "true"}
                >
                    <div className="mseg-modal-head">
                        <div className="mseg-modal-copy">
                            <div className="mseg-eyebrow">{slotLabel}</div>
                            <strong className="mseg-route-title">Modulation Shape</strong>
                        </div>
                        <button
                            className="mseg-modal-close"
                            type="button"
                            aria-label="Close MSEG editor"
                            data-role="mseg-modal-close"
                            onClick={onClose}
                        >
                            x
                        </button>
                    </div>

                    <div className="mseg-modal-stage">
                        {msegState ? (
                            <EditableMsegSurface
                                surfaceRef={surfaceRef}
                                dataRole="mseg-modal-viewport"
                                className="mseg-surface mseg-modal-surface"
                                orientation={orientation}
                                points={msegState.shape.points}
                                referencePoints={msegState.referenceShape?.points ?? null}
                                selectedPointIndex={selectedPointIndex}
                                hoveredSegmentIndex={hoveredSegmentIndex}
                                activeSegmentIndex={activeSegmentIndex}
                                onPointerDown={onPointerDown}
                                onPointerMove={onPointerMove}
                                onPointerLeave={onPointerLeave}
                                onPointerUp={onPointerUp}
                            />
                        ) : null}
                    </div>

                    <div className="mseg-modal-footer">
                        <label className="mseg-rate">
                            <span className="mseg-depth-label">Morph</span>
                            <input
                                className="mseg-rate-slider"
                                type="range"
                                aria-label="MSEG morph"
                                data-role="mseg-morph-slider"
                                data-modulation-target-kind={`mseg${slotIndex + 1}Morph`}
                                min="0"
                                max="1"
                                step="0.001"
                                value={selectedMsegMorph.value.toFixed(3)}
                                disabled={!selectedMsegMorph.isReady}
                                data-host-state={selectedMsegMorph.isReady ? "ready" : "loading"}
                                onChange={(event) => onMorphChange(Number(event.currentTarget.value))}
                            />
                        </label>
                        <label className="mseg-rate">
                            <span className="mseg-depth-label">Time In Seconds</span>
                            <input
                                className="mseg-rate-slider"
                                type="range"
                                aria-label="MSEG time in seconds"
                                data-modulation-target-kind={`mseg${slotIndex + 1}Rate`}
                                min={MSEG_RATE_MIN_SECONDS.toFixed(3)}
                                max={MSEG_RATE_MAX_SECONDS.toFixed(3)}
                                step="0.001"
                                value={clampMsegRateSeconds(rateSeconds).toFixed(3)}
                                disabled={!rateReady}
                                data-host-state={rateReady ? "ready" : "loading"}
                                onChange={(event) => onRateChange(Number(event.target.value))}
                                {...rateFocusBindings}
                            />
                        </label>
                        <div className="mseg-modal-footer-actions">
                            {msegState ? (
                                <div style={{ display: "flex", gap: "0.35rem" }}>
                                    {[0, 1].map((shapeIndex) => (
                                        <button
                                            key={`ios-modal-mseg-shape-${shapeIndex}`}
                                            className="mseg-loop-button"
                                            type="button"
                                            aria-label={`Edit MSEG shape ${shapeIndex === 0 ? "A" : "B"}`}
                                            aria-pressed={msegState.editShapeIndex === shapeIndex}
                                            onClick={() => onSelectShape(shapeIndex)}
                                        >
                                            {shapeIndex === 0 ? "A" : "B"}
                                        </button>
                                    ))}
                                </div>
                            ) : null}
                            <div className="mseg-rate-readout" data-role="mseg-rate-readout">
                                {formatParameterEntry(msegRateEntrySpec(rateSeconds), rateSeconds).display}
                            </div>
                            <button
                                className="mseg-loop-button"
                                type="button"
                                data-role="mseg-loop-button"
                                aria-pressed={msegState?.playback.loop ? "true" : "false"}
                                aria-label="Toggle full-shape loop"
                                onClick={onToggleLoop}
                            >
                                Loop
                            </button>
                        </div>
                    </div>
                </section>
            ) : null}
        </div>
    );
});

function IOSPatchViewBody() {
    const stageRef = useRef<HTMLDivElement | null>(null);
    const msegEditorSurfaceRef = useRef<SVGSVGElement | null>(null);
    const keyboardRef = useRef<IOSPianoKeyboardElement | null>(null);
    const [keyboardRootNote, setKeyboardRootNote] = useState(KEYBOARD_ROOT_NOTE_DEFAULT);
    const [isMsegModalOpen, setIsMsegModalOpen] = useState(false);
    const layout = useIOSViewportLayout();
    const msegPreviewOrientation: MsegSurfaceOrientation = "horizontal";
    const msegEditorOrientation: MsegSurfaceOrientation = layout.isPortrait ? "vertical" : "horizontal";
    const oscillatorSelection = useOscillatorSelectionViewModel();
    const [armedSource, setArmedSource] = useState<MobileVoiceArmedSource>({ sourceKind: "mseg", sourceSlot: 1 });
    const [mobileVoiceHudLayer, setMobileVoiceHudLayer] = useState<HTMLDivElement | null>(null);
    const synthView = useSynthPatchViewModel({
        oscillatorID: oscillatorSelection.selectedOscillatorID,
        stageRef,
        msegEditorSurfaceRef,
        keyboardRef,
        voiceModeCount: VOICE_MODE_OPTIONS.length,
        msegSurfaceOrientation: msegEditorOrientation,
        msegCurveEditActivationMode: "hold-or-drag",
        onMsegCurveEditHoldActivated: () => {
            triggerIOSHaptic("light");
        },
    });
    const distortionWetHPKeyTrack = useLaneKeyTrackControlBinding(DISTORTION_WET_HP_DESCRIPTOR);
    const distortionWetLPKeyTrack = useLaneKeyTrackControlBinding(DISTORTION_WET_LP_DESCRIPTOR);

    /* T20 — the ADR-017 long-press parameter menu (shared shell machine). */
    const { openParameterMenu, parameterMenuOverlays } = useParameterMenuShell({
        routes: synthView.routes,
        armedSourceKind: armedSource.sourceKind,
        armedSourceSlot: armedSource.sourceSlot,
        onRouteChange: synthView.handleRouteChange,
        onRemoveRoute: synthView.handleRemoveRoute,
    });
    const shellStyle = useMemo(() => ({
        ["--cosimo-stage-min-height" as string]: `${layout.stageMinHeight}px`,
        ["--cosimo-keyboard-height" as string]: `${layout.keyboardHeight}px`,
        ["--cosimo-control-height" as string]: `${layout.controlHeight}px`,
    }) satisfies CSSProperties, [layout.controlHeight, layout.keyboardHeight, layout.stageMinHeight]);


    const handleSelectWavetable = useCallback((nextValue: number) => {
        synthView.handleSelectWavetable(nextValue);
    }, [synthView]);

    const openMsegModal = useCallback(() => {
        setIsMsegModalOpen(true);
    }, []);

    const closeMsegModal = useCallback(() => {
        setIsMsegModalOpen(false);
    }, []);

    const handleOctaveDown = useCallback(() => {
        setKeyboardRootNote((previousRootNote) => clamp(previousRootNote - 12, KEYBOARD_ROOT_NOTE_MIN, KEYBOARD_ROOT_NOTE_MAX));
    }, []);

    const handleOctaveUp = useCallback(() => {
        setKeyboardRootNote((previousRootNote) => clamp(previousRootNote + 12, KEYBOARD_ROOT_NOTE_MIN, KEYBOARD_ROOT_NOTE_MAX));
    }, []);

    const voiceStatusText = useMemo(() => {
        if (synthView.frameError) {
            return formatIOSFactoryLibraryLoadMessage("Could not load wavetable bank", synthView.frameError);
        }
        if (synthView.catalogError) {
            return formatIOSFactoryLibraryLoadMessage("Could not load wavetable catalog", synthView.catalogError);
        }
        if (synthView.runtimePresentation.failureMessage) {
            return synthView.runtimePresentation.failureMessage;
        }
        return null;
    }, [
        synthView.catalogError,
        synthView.frameError,
        synthView.runtimePresentation.failureMessage,
    ]);

    const resolveIOSVoiceScrollLocks = useCallback(() => (
        Array.from(document.querySelectorAll<HTMLElement>(".ios-scroll"))
    ), []);
    const requestIOSVoiceHaptic = useCallback(() => {
        triggerIOSHaptic("light");
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

    return (
        <ParameterHudLayerContext.Provider value={mobileVoiceHudLayer}>
        <ParameterMenuContext.Provider value={openParameterMenu}>
        <div className="ios-shell" style={shellStyle}>
            <div
                ref={setMobileVoiceHudLayer}
                data-role="ios-mobile-voice-hud-layer"
                className="ios-mobile-voice-hud-layer"
                aria-hidden={false}
            />
            <div className="ios-top-row">
                <div
                    className="ios-main-view"
                    data-hidden={isMsegModalOpen ? "true" : "false"}
                    aria-hidden={isMsegModalOpen ? "true" : "false"}
                >
                    <div className="ios-scroll">
                        <div className="ios-content">
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
                                    onTableChange: handleSelectWavetable,
                                    onTablePrewarm: synthView.handlePrewarmWavetablePicker,
                                    canRetry: synthView.canRetryDesiredTableLoad,
                                    onRetry: synthView.handleRetryLoad,
                                }}
                                routes={synthView.routes}
                                armedSource={armedSource}
                                hudContainer={mobileVoiceHudLayer}
                                resolveScrollLockTargets={resolveIOSVoiceScrollLocks}
                                onRequestHaptic={requestIOSVoiceHaptic}
                                onRequestParameterMenu={openParameterMenu}
                            />

                            {voiceStatusText !== null ? (
                                <div className="ios-voice-status" data-role="ios-voice-status" role="status">
                                    {voiceStatusText}
                                </div>
                            ) : null}

                            <div className="ios-armed-source-row" data-role="ios-armed-source">
                                <span className="ios-armed-source-label">Mod Source</span>
                                <select
                                    aria-label="Modulation source type"
                                    value={armedSource.sourceKind}
                                    onChange={(event) => setArmedSource((current) => ({
                                        ...current,
                                        sourceKind: event.target.value === "env" ? "env" : event.target.value === "macro" ? "macro" : "mseg",
                                        sourceSlot: event.target.value === "env"
                                            ? clamp(current.sourceSlot, 1, 4)
                                            : clamp(current.sourceSlot, 1, 3),
                                    }))}
                                >
                                    <option value="mseg">MSEG</option>
                                    <option value="env">Envelope</option>
                                    <option value="macro">Macro</option>
                                </select>
                                <select
                                    aria-label="Modulation source number"
                                    value={String(armedSource.sourceSlot)}
                                    onChange={(event) => setArmedSource((current) => ({
                                        ...current,
                                        sourceSlot: clamp(
                                            Math.round(Number(event.target.value) || 1),
                                            1,
                                            current.sourceKind === "env" ? 4 : 3,
                                        ),
                                    }))}
                                >
                                    <option value="1">1</option>
                                    <option value="2">2</option>
                                    <option value="3">3</option>
                                    {armedSource.sourceKind === "env" ? (
                                        <option value="4">Amp</option>
                                    ) : null}
                                </select>
                            </div>

                            <IOSPlayPanel
                                playModeValue={synthView.playMode.value}
                                playModeReady={synthView.playMode.isReady}
                                onPlayModeChange={synthView.playMode.commitValue}
                                playModeFocusBindings={synthView.keyboardRouting.playModeFocusBindings}
                                glideValue={synthView.glideTime.value}
                                glideReady={synthView.glideTime.isReady}
                                onGlideChange={synthView.glideTime.commitValue}
                                glideFocusTarget={synthView.keyboardRouting.glideFocusTarget}
                                globalTune={synthView.globalTune}
                                routes={synthView.routes}
                                armedSource={armedSource}
                            />

                            <IOSDistortionPanel
                                modeValue={synthView.distortionMode.value}
                                typeValue={synthView.distortionType.value}
                                driveValue={synthView.distortionDriveDb.value}
                                kneeValue={synthView.distortionKnee.value}
                                wetValue={synthView.distortionWet.value}
                                wetHPKeyTrack={distortionWetHPKeyTrack}
                                wetLPKeyTrack={distortionWetLPKeyTrack}
                                historyFrame={synthView.observedDistortionHistory}
                                scopeFrame={synthView.observedDistortionScope}
                                onModeChange={synthView.distortionMode.commitValue}
                                onTypeChange={synthView.distortionType.commitValue}
                                onDriveChange={synthView.distortionDriveDb.commitValue}
                                onKneeChange={synthView.distortionKnee.commitValue}
                                onWetChange={synthView.distortionWet.commitValue}
                            />

                            <IOSMsegLauncher
                                msegState={synthView.msegState}
                                observedMsegPlayhead={synthView.observedMsegPlayhead}
                                selectedMsegSlot={synthView.selectedMsegSlot}
                                selectedMsegMorph={synthView.selectedMsegMorph}
                                previewOrientation={msegPreviewOrientation}
                                onOpenEditor={openMsegModal}
                                onToggleLoop={synthView.handleToggleMsegLoop}
                                onSelectMsegShape={synthView.handleSelectMsegShape}
                                onMsegMorphChange={synthView.handleMsegMorphChange}
                                panBinding={synthView.pan}
                                onSelectMsegSlot={synthView.handleSelectMsegSlot}
                            />

                            <IOSModulationMatrixPanel
                                selectedEnvelopeSlot={synthView.selectedEnvelopeSlot}
                                selectedEnvelope={synthView.selectedEnvelope}
                                envelopeReadiness={synthView.callbackControlReadiness.envelope}
                                routes={synthView.routes}
                                onSelectEnvelopeSlot={synthView.handleSelectEnvelopeSlot}
                                onEnvelopeChange={synthView.handleEnvelopeChange}
                                onAddRoute={synthView.handleAddRoute}
                                onRemoveRoute={synthView.handleRemoveRoute}
                                onRouteChange={synthView.handleRouteChange}
                            />

                            <IOSKeyboardToolbar
                                keyboardRootLabel={formatKeyboardRangeLabel(keyboardRootNote, layout.noteCount)}
                                canOctaveDown={keyboardRootNote > KEYBOARD_ROOT_NOTE_MIN}
                                canOctaveUp={keyboardRootNote < KEYBOARD_ROOT_NOTE_MAX}
                                onOctaveDown={handleOctaveDown}
                                onOctaveUp={handleOctaveUp}
                            />
                        </div>
                    </div>
                </div>

                <IOSMsegModal
                    isOpen={isMsegModalOpen}
                    onClose={closeMsegModal}
                    slotLabel={`MSEG ${synthView.selectedMsegSlot + 1}`}
                    slotIndex={synthView.selectedMsegSlot}
                    msegState={synthView.msegState}
                    selectedMsegMorph={synthView.selectedMsegMorph}
                    surfaceRef={msegEditorSurfaceRef}
                    orientation={msegEditorOrientation}
                    selectedPointIndex={synthView.msegEditor.selectedPointIndex}
                    hoveredSegmentIndex={synthView.msegEditor.hoveredSegmentIndex}
                    activeSegmentIndex={synthView.msegEditor.activeSegmentIndex}
                    onPointerDown={synthView.msegEditor.handlePointerDown}
                    onPointerMove={synthView.msegEditor.handlePointerMove}
                    onPointerLeave={synthView.msegEditor.handlePointerLeave}
                    onPointerUp={synthView.msegEditor.handlePointerUp}
                    rateSeconds={synthView.msegState?.playback.rate.seconds ?? 1}
                    rateReady={synthView.callbackControlReadiness.mseg.rate}
                    onSelectShape={synthView.handleSelectMsegShape}
                    onMorphChange={synthView.handleMsegMorphChange}
                    onRateChange={synthView.handleMsegRateChange}
                    onToggleLoop={synthView.handleToggleMsegLoop}
                    rateFocusBindings={synthView.keyboardRouting.msegRateFocusBindings}
                />
            </div>

            <div className="keyboard-footer">
                <IOSKeyboardDock
                    rootNote={keyboardRootNote}
                    noteCount={layout.noteCount}
                    naturalNoteWidth={layout.keyboardNaturalNoteWidth}
                    accidentalWidth={layout.keyboardAccidentalWidth}
                    keyboardRef={keyboardRef}
                />
            </div>
            {parameterMenuOverlays}
        </div>
        </ParameterMenuContext.Provider>
        </ParameterHudLayerContext.Provider>
    );
}

export function IOSPatchView({
    patchConnection,
    resourceClient,
}: {
    patchConnection: PatchConnectionLike;
    resourceClient: ResourceClient;
}) {
    return (
        <PatchConnectionProvider patchConnection={patchConnection} resourceClient={resourceClient}>
            <IOSPatchViewBody />
        </PatchConnectionProvider>
    );
}
