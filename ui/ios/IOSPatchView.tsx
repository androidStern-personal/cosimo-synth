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
    WavetableCanvas,
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
    MODULATION_TARGET_OPTIONS,
    clampModulationRouteAmount,
    applyModulationSourceOption,
    MODULATION_ENV_SLOT_COUNT,
    MODULATION_MSEG_SLOT_COUNT,
    getModulationSourceOptionValue,
    type ModulationRoute,
} from "../shared/modulation";
import {
    clampDisplayPosition,
} from "../shared/runtime-table-state";
import {
    resolveDisplayGestureAxis,
    resolveHorizontalSwipeTarget,
    shouldCommitHorizontalSwipe,
} from "../shared/display-gesture";
import {
    useSynthPatchViewModel,
} from "../shared/synth-hooks";
import {
    IOSKeyboardDock,
    type IOSPianoKeyboardElement,
} from "./ios-keyboard-adapter";

const NOTE_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
const KEYBOARD_ROOT_NOTE_DEFAULT = 36;
const KEYBOARD_ROOT_NOTE_MIN = 12;
const KEYBOARD_ROOT_NOTE_MAX = 72;
const DISTORTION_WET_HP_MIN_HZ = 20;
const DISTORTION_WET_HP_MAX_HZ = 4_000;
const DISTORTION_WET_LP_MIN_HZ = 20;
const DISTORTION_WET_LP_MAX_HZ = 20_000;
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

type ActiveStageGesture = {
    pointerId: number;
    startClientX: number;
    startClientY: number;
    startTableIndex: number;
    startPosition: number;
    dragSpanX: number;
    dragSpanY: number;
    currentDeltaX: number;
    mode: "pending" | "horizontal" | "vertical";
};

type IOSPlayPanelProps = {
    playModeValue: number;
    onPlayModeChange: (nextValue: number) => void;
    playModeFocusBindings: ReturnType<typeof useSynthPatchViewModel>["keyboardRouting"]["playModeFocusBindings"];
    glideValue: number;
    onGlideChange: (nextValue: number) => void;
    glideFocusTarget: ReturnType<typeof useSynthPatchViewModel>["keyboardRouting"]["glideFocusTarget"];
};

function clamp(value: number, min: number, max: number) {
    return Math.min(Math.max(value, min), max);
}

function formatGlideTime(seconds: number) {
    return `${Number(seconds).toFixed(3)} s`;
}

function formatSeconds(seconds: number) {
    return `${clampMsegRateSeconds(seconds).toFixed(3)} s`;
}

function formatDriveDb(value: number) {
    return `${Number(value).toFixed(1)} dB`;
}

function formatPercent(value: number) {
    return `${Math.round(clamp(Number(value) || 0, 0, 1) * 100)}%`;
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
        && previousProps.onPlayModeChange === nextProps.onPlayModeChange
        && previousProps.playModeFocusBindings.onPointerDownCapture === nextProps.playModeFocusBindings.onPointerDownCapture
        && previousProps.playModeFocusBindings.onFocusCapture === nextProps.playModeFocusBindings.onFocusCapture
        && previousProps.glideValue === nextProps.glideValue
        && previousProps.onGlideChange === nextProps.onGlideChange
        && previousProps.glideFocusTarget.onActivate === nextProps.glideFocusTarget.onActivate
        && previousProps.glideFocusTarget.onBeginTextEntry === nextProps.glideFocusTarget.onBeginTextEntry
        && previousProps.glideFocusTarget.onEndTextEntry === nextProps.glideFocusTarget.onEndTextEntry;
}

const IOSPlayPanel = memo(function IOSPlayPanel({
    playModeValue,
    onPlayModeChange,
    playModeFocusBindings,
    glideValue,
    onGlideChange,
    glideFocusTarget,
}: IOSPlayPanelProps) {
    return (
        <div className="play-panel">
            <div className="play-grid">
                <label className="play-field" aria-label="Voice mode">
                    <select
                        className="play-select play-mode-select"
                        aria-label="Voice mode"
                        value={String(playModeValue)}
                        onChange={(event) => onPlayModeChange(Number(event.target.value))}
                        {...playModeFocusBindings}
                    >
                        {VOICE_MODE_OPTIONS.map((option) => (
                            <option key={option.value} value={option.value}>{option.label}</option>
                        ))}
                    </select>
                </label>
                <label className="play-field" aria-label="Glide time">
                    <div className="glide-field-body">
                        <input
                            className="glide-time-slider"
                            type="range"
                            min="0"
                            max="1"
                            step="0.001"
                            value={Math.min(glideValue, 1).toFixed(3)}
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
    selectedMsegSlot,
    previewOrientation,
    onOpenEditor,
    onToggleLoop,
    panValue,
    onPanChange,
    onSelectMsegSlot,
}: {
    msegState: ReturnType<typeof useSynthPatchViewModel>["msegState"];
    selectedMsegSlot: number;
    previewOrientation: MsegSurfaceOrientation;
    onOpenEditor: () => void;
    onToggleLoop: () => void;
    panValue: number;
    onPanChange: (nextValue: number) => void;
    onSelectMsegSlot: (slotIndex: number) => void;
}) {
    return (
        <div className="mseg-shell">
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
                            />
                        ) : null}
                    </div>
                </button>

                <div className="mseg-preview-footer">
                    <div className="mseg-launcher-rate-readout" data-role="mseg-launcher-rate-readout">
                        {msegState ? formatSeconds(msegState.playback.rate.seconds) : "1.000 s"}
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
                            type="range"
                            min="-1"
                            max="1"
                            step="0.001"
                            value={Number(panValue).toFixed(3)}
                            onChange={(event) => onPanChange(Number(event.target.value))}
                        />
                    </label>
                    <div className="mseg-depth-readout">
                        {Number(panValue).toFixed(3)}
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
        <div className="keyboard-toolbar">
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

const IOSModulationMatrixPanel = memo(function IOSModulationMatrixPanel({
    selectedEnvelopeSlot,
    selectedEnvelope,
    routes,
    onSelectEnvelopeSlot,
    onEnvelopeChange,
    onAddRoute,
    onRemoveRoute,
    onRouteChange,
}: {
    selectedEnvelopeSlot: number;
    selectedEnvelope: ReturnType<typeof useSynthPatchViewModel>["selectedEnvelope"];
    routes: ReturnType<typeof useSynthPatchViewModel>["routes"];
    onSelectEnvelopeSlot: (slotIndex: number) => void;
    onEnvelopeChange: (field: "attackSeconds" | "decaySeconds" | "sustain" | "releaseSeconds", nextValue: number) => void;
    onAddRoute: () => void;
    onRemoveRoute: (routeIndex: number) => void;
    onRouteChange: (routeIndex: number, nextRoute: ModulationRoute) => void;
}) {
    return (
        <div style={{
            display: "grid",
            gap: "0.9rem",
            border: "1px solid rgba(255,255,255,0.08)",
            borderRadius: "24px",
            padding: "1rem",
            background: "rgba(255,255,255,0.03)",
        }}
        >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "0.75rem" }}>
                <div>
                    <div className="mseg-eyebrow">Envelopes + Routes</div>
                    <strong className="mseg-route-title">Modulation Matrix</strong>
                </div>
            </div>

            <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
                {Array.from({ length: MODULATION_ENV_SLOT_COUNT }, (_, slotIndex) => (
                    <button
                        key={`ios-env-slot-${slotIndex + 1}`}
                        type="button"
                        aria-label={`Select envelope ${slotIndex + 1}`}
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
                        {`Env ${slotIndex + 1}`}
                    </button>
                ))}
            </div>

            <div style={{ display: "grid", gap: "0.75rem" }}>
                {[
                    ["attackSeconds", "Attack", 0.001, 10, 0.001, Number(selectedEnvelope?.attackSeconds ?? 0.01)],
                    ["decaySeconds", "Decay", 0.001, 10, 0.001, Number(selectedEnvelope?.decaySeconds ?? 0.25)],
                    ["sustain", "Sustain", 0, 1, 0.001, Number(selectedEnvelope?.sustain ?? 0.5)],
                    ["releaseSeconds", "Release", 0.001, 10, 0.001, Number(selectedEnvelope?.releaseSeconds ?? 0.2)],
                ].map(([field, label, min, max, step, value]) => (
                    <label key={String(field)} style={{ display: "grid", gap: "0.35rem" }}>
                        <span className="mseg-depth-label">{String(label)}</span>
                        <input
                            className="mseg-rate-slider"
                            type="range"
                            min={String(min)}
                            max={String(max)}
                            step={String(step)}
                            value={Number(value).toFixed(3)}
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
                                    onRouteChange(routeIndex, applyModulationSourceOption(route, event.target.value));
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
                                        ...route,
                                        targetKind: nextTargetKind as ModulationRoute["targetKind"],
                                        amount: clampModulationRouteAmount(nextTargetKind as ModulationRoute["targetKind"], route.amount),
                                    });
                                }}
                            >
                                {MODULATION_TARGET_OPTIONS.map((option) => (
                                    <option key={option.value} value={option.value}>{option.label}</option>
                                ))}
                            </select>
                            <ModulationAmountField
                                targetKind={route.targetKind}
                                polarity={route.polarity}
                                amount={route.amount}
                                onPolarityChange={(nextPolarity) => {
                                    onRouteChange(routeIndex, {
                                        ...route,
                                        polarity: nextPolarity,
                                    });
                                }}
                                knobAriaLabel={`Route ${routeIndex + 1} depth`}
                                polarityAriaLabel={`Route ${routeIndex + 1} polarity`}
                                onChange={(nextAmount) => {
                                    onRouteChange(routeIndex, {
                                        ...route,
                                        amount: nextAmount,
                                    });
                                }}
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

const IOSDistortionPanel = memo(function IOSDistortionPanel({
    driveValue,
    kneeValue,
    wetValue,
    wetHPHzValue,
    wetLPHzValue,
    scopeFrame,
    onDriveChange,
    onKneeChange,
    onWetChange,
    onWetHPHzChange,
    onWetLPHzChange,
}: {
    driveValue: number;
    kneeValue: number;
    wetValue: number;
    wetHPHzValue: number;
    wetLPHzValue: number;
    scopeFrame: ReturnType<typeof useSynthPatchViewModel>["observedDistortionScope"];
    onDriveChange: (nextValue: number) => void;
    onKneeChange: (nextValue: number) => void;
    onWetChange: (nextValue: number) => void;
    onWetHPHzChange: (nextValue: number) => void;
    onWetLPHzChange: (nextValue: number) => void;
}) {
    const inputPeak = scopeFrame?.inputPeak ?? 0;
    const outputPeak = scopeFrame?.outputPeak ?? 0;
    const removedPeak = scopeFrame?.removedPeak ?? 0;
    const overshoot = Math.max(0, inputPeak - 1);
    const headroom = Math.max(0, 1 - inputPeak);

    return (
        <div
            data-role="ios-distortion-panel"
            style={{
                display: "grid",
                gap: "0.9rem",
                border: "1px solid rgba(255,255,255,0.08)",
                borderRadius: "24px",
                padding: "1rem",
                background: "linear-gradient(180deg, rgba(22,10,16,0.96), rgba(7,8,14,0.98))",
                boxShadow: "inset 0 1px 0 rgba(255,255,255,0.06)",
            }}
        >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", gap: "0.75rem" }}>
                <div>
                    <div className="mseg-eyebrow">Distortion</div>
                    <strong className="mseg-route-title">Wet Curve + Waveform</strong>
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
                    <div>{`Out ${outputPeak.toFixed(3)} • Removed ${removedPeak.toFixed(3)}`}</div>
                </div>
            </div>

            <DistortionVisualizer
                knee={kneeValue}
                frame={scopeFrame}
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
                        readout: formatPercent(kneeValue),
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
                        readout: formatPercent(wetValue),
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

                <label style={{ display: "grid", gap: "0.32rem" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", gap: "0.75rem" }}>
                        <span className="mseg-depth-label">Wet HP</span>
                        <span style={{
                            fontFamily: "\"SF Mono\", Menlo, monospace",
                            fontSize: "0.72rem",
                            letterSpacing: "0.08em",
                            color: "rgba(226,232,240,0.92)",
                        }}
                        >
                            {formatFrequencyHz(wetHPHzValue)}
                        </span>
                    </div>
                    <input
                        data-role="distortion-wet-hp-slider"
                        className="mseg-rate-slider"
                        type="range"
                        min="0"
                        max="1"
                        step="0.001"
                        value={frequencyHzToLogNormalized(wetHPHzValue, DISTORTION_WET_HP_MIN_HZ, DISTORTION_WET_HP_MAX_HZ).toFixed(3)}
                        onChange={(event) => {
                            const nextValue = clamp(
                                normalizedToLogFrequencyHz(Number(event.target.value), DISTORTION_WET_HP_MIN_HZ, DISTORTION_WET_HP_MAX_HZ),
                                DISTORTION_WET_HP_MIN_HZ,
                                Math.min(DISTORTION_WET_HP_MAX_HZ, wetLPHzValue),
                            );
                            onWetHPHzChange(nextValue);
                        }}
                    />
                </label>

                <label style={{ display: "grid", gap: "0.32rem" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", gap: "0.75rem" }}>
                        <span className="mseg-depth-label">Wet LP</span>
                        <span style={{
                            fontFamily: "\"SF Mono\", Menlo, monospace",
                            fontSize: "0.72rem",
                            letterSpacing: "0.08em",
                            color: "rgba(226,232,240,0.92)",
                        }}
                        >
                            {formatFrequencyHz(wetLPHzValue)}
                        </span>
                    </div>
                    <input
                        data-role="distortion-wet-lp-slider"
                        className="mseg-rate-slider"
                        type="range"
                        min="0"
                        max="1"
                        step="0.001"
                        value={frequencyHzToLogNormalized(wetLPHzValue, DISTORTION_WET_LP_MIN_HZ, DISTORTION_WET_LP_MAX_HZ).toFixed(3)}
                        onChange={(event) => {
                            const nextValue = clamp(
                                normalizedToLogFrequencyHz(Number(event.target.value), DISTORTION_WET_LP_MIN_HZ, DISTORTION_WET_LP_MAX_HZ),
                                Math.max(DISTORTION_WET_LP_MIN_HZ, wetHPHzValue),
                                DISTORTION_WET_LP_MAX_HZ,
                            );
                            onWetLPHzChange(nextValue);
                        }}
                    />
                </label>
            </div>
        </div>
    );
});

const IOSMsegModal = memo(function IOSMsegModal({
    isOpen,
    onClose,
    slotLabel,
    msegState,
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
    onRateChange,
    onToggleLoop,
    rateFocusBindings,
}: {
    isOpen: boolean;
    onClose: () => void;
    slotLabel: string;
    msegState: ReturnType<typeof useSynthPatchViewModel>["msegState"];
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
    onRateChange: (nextValue: number) => void;
    onToggleLoop: () => void;
    rateFocusBindings: ReturnType<typeof useSynthPatchViewModel>["keyboardRouting"]["msegRateFocusBindings"];
}) {
    return (
        <div className="mseg-modal-layer" data-role="mseg-modal-layer" data-open={isOpen ? "true" : "false"}>
            {isOpen ? (
                <section
                    className="mseg-modal"
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
                            <span className="mseg-depth-label">Time In Seconds</span>
                            <input
                                className="mseg-rate-slider"
                                type="range"
                                aria-label="MSEG time in seconds"
                                min={MSEG_RATE_MIN_SECONDS.toFixed(3)}
                                max={MSEG_RATE_MAX_SECONDS.toFixed(3)}
                                step="0.001"
                                value={clampMsegRateSeconds(rateSeconds).toFixed(3)}
                                onChange={(event) => onRateChange(Number(event.target.value))}
                                {...rateFocusBindings}
                            />
                        </label>
                        <div className="mseg-modal-footer-actions">
                            <div className="mseg-rate-readout" data-role="mseg-rate-readout">
                                {formatSeconds(rateSeconds)}
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

const IOSWavetablePanel = memo(function IOSWavetablePanel({
    stageRef,
    frames,
    observedPosition,
    warpMode,
    warpAmount,
    displayedFrameCount,
    displayedTableIndex,
    desiredTableIndex,
    tableOptions,
    shouldShowOverlay,
    displayStatus,
    tableErrorText,
    bankReadout,
    canRetryDesiredTableLoad,
    wavetableFocusBindings,
    wavetablePosition,
    onSelectWavetable,
    onRetryLoad,
}: {
    stageRef: RefObject<HTMLDivElement | null>;
    frames: Float32Array[] | null;
    observedPosition: number;
    warpMode: number;
    warpAmount: number;
    displayedFrameCount: number;
    displayedTableIndex: number;
    desiredTableIndex: number;
    tableOptions: ReturnType<typeof useSynthPatchViewModel>["tableOptions"];
    shouldShowOverlay: boolean;
    displayStatus: string;
    tableErrorText: string | null;
    bankReadout: string;
    canRetryDesiredTableLoad: boolean;
    wavetableFocusBindings: ReturnType<typeof useSynthPatchViewModel>["keyboardRouting"]["wavetableFocusBindings"];
    wavetablePosition: ReturnType<typeof useSynthPatchViewModel>["wavetablePosition"];
    onSelectWavetable: (nextValue: number) => void;
    onRetryLoad: () => void;
}) {
    const activeStageGestureRef = useRef<ActiveStageGesture | null>(null);

    const handleStagePointerDown = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
        if (event.button !== 0) {
            return;
        }

        if ((event.target as HTMLElement | null)?.closest?.(".bank-picker-trigger, select, button, input")) {
            return;
        }

        const bounds = event.currentTarget.getBoundingClientRect();
        activeStageGestureRef.current = {
            pointerId: event.pointerId,
            startClientX: event.clientX,
            startClientY: event.clientY,
            startTableIndex: displayedTableIndex,
            startPosition: observedPosition,
            dragSpanX: bounds.width,
            dragSpanY: bounds.height,
            currentDeltaX: 0,
            mode: "pending",
        };
        event.currentTarget.setPointerCapture(event.pointerId);
        event.preventDefault();
    }, [displayedTableIndex, observedPosition]);

    const handleStagePointerMove = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
        const activeStageGesture = activeStageGestureRef.current;
        if (!activeStageGesture || activeStageGesture.pointerId !== event.pointerId) {
            return;
        }

        const deltaX = event.clientX - activeStageGesture.startClientX;
        const deltaY = event.clientY - activeStageGesture.startClientY;
        const gestureAxis = resolveDisplayGestureAxis(deltaX, deltaY);

        if (activeStageGesture.mode === "pending" && gestureAxis !== "pending") {
            activeStageGesture.mode = gestureAxis;

            if (gestureAxis === "vertical") {
                wavetablePosition.beginGesture();
            }
        }

        if (activeStageGesture.mode === "horizontal") {
            activeStageGesture.currentDeltaX = deltaX;
            event.preventDefault();
            return;
        }

        if (activeStageGesture.mode !== "vertical") {
            return;
        }

        const nextPosition = clampDisplayPosition(
            activeStageGesture.startPosition
                + ((activeStageGesture.startClientY - event.clientY) / Math.max(1, activeStageGesture.dragSpanY)),
        );
        wavetablePosition.setValue(nextPosition);
        event.preventDefault();
    }, [wavetablePosition]);

    const endStageGesture = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
        const activeStageGesture = activeStageGestureRef.current;
        if (!activeStageGesture || activeStageGesture.pointerId !== event.pointerId) {
            return;
        }

        event.currentTarget.releasePointerCapture?.(event.pointerId);

        if (activeStageGesture.mode === "vertical") {
            wavetablePosition.endGesture();
            activeStageGestureRef.current = null;
            event.preventDefault();
            return;
        }

        if (activeStageGesture.mode === "horizontal") {
            const swipeTarget = resolveHorizontalSwipeTarget(
                activeStageGesture.startTableIndex,
                activeStageGesture.currentDeltaX,
                tableOptions.length,
            );

            if (
                swipeTarget.hasTarget &&
                shouldCommitHorizontalSwipe(activeStageGesture.currentDeltaX, activeStageGesture.dragSpanX)
            ) {
                onSelectWavetable(swipeTarget.targetTableIndex);
            }
        }

        activeStageGestureRef.current = null;
        event.preventDefault();
    }, [onSelectWavetable, tableOptions.length, wavetablePosition]);

    return (
        <div className="wavetable-panel">
            <div
                ref={stageRef}
                className="wavetable-stage"
                data-state={shouldShowOverlay ? "loading" : "ready"}
                onPointerDown={handleStagePointerDown}
                onPointerMove={handleStagePointerMove}
                onPointerUp={endStageGesture}
                onPointerCancel={endStageGesture}
            >
                <div className="wavetable-display-stack">
                    <div className="wavetable-layer">
                        <WavetableCanvas
                            frames={frames}
                            position={observedPosition}
                            warpMode={warpMode}
                            warpAmount={warpAmount}
                        />
                    </div>
                    <div className="wavetable-layer" aria-hidden="true" />
                </div>
                <div className="display-overlay" hidden={!shouldShowOverlay}>
                    {displayStatus}
                </div>
                <div className="stage-copy">
                    <div className="stage-copy-row">
                        <div className="mini-label active">Wavescan</div>
                        <div className="display-status" data-role="display-status">{displayStatus}</div>
                        <div className="shape-readout" data-role="hero-frame-readout">
                            {formatFrameReadout(observedPosition, displayedFrameCount)}
                        </div>
                    </div>
                    <div
                        className="table-error-banner"
                        data-role="table-error-banner"
                        hidden={!tableErrorText}
                    >
                        {tableErrorText ?? ""}
                    </div>
                    <div />
                    <div className="stage-copy-row">
                        <label className="bank-picker-trigger">
                            <div className="bank-readout">{bankReadout}</div>
                            <select
                                className="table-select table-select-overlay"
                                aria-label="Select wavetable"
                                value={String(desiredTableIndex)}
                                onChange={(event) => onSelectWavetable(Number(event.target.value))}
                                {...wavetableFocusBindings}
                            >
                                {tableOptions.map((table, tableIndex) => (
                                    <option key={`${table.tableId}-${tableIndex}`} value={tableIndex}>
                                        {table.name}
                                    </option>
                                ))}
                            </select>
                        </label>
                        <button
                            className="table-retry-button"
                            type="button"
                            hidden={!canRetryDesiredTableLoad}
                            disabled={!canRetryDesiredTableLoad}
                            onClick={onRetryLoad}
                        >
                            Retry
                        </button>
                        <div className="mini-label warm" data-role="stage-gesture-hint">Swipe + Drag</div>
                    </div>
                </div>
            </div>
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
    const synthView = useSynthPatchViewModel({
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

    const shellStyle = useMemo(() => ({
        ["--cosimo-stage-min-height" as string]: `${layout.stageMinHeight}px`,
        ["--cosimo-keyboard-height" as string]: `${layout.keyboardHeight}px`,
        ["--cosimo-control-height" as string]: `${layout.controlHeight}px`,
    }) satisfies CSSProperties, [layout.controlHeight, layout.keyboardHeight, layout.stageMinHeight]);

    const displayStatus = useMemo(() => {
        if (synthView.frameError) {
            return formatIOSFactoryLibraryLoadMessage("Could not load wavetable bank", synthView.frameError);
        }

        if (synthView.catalogError) {
            return formatIOSFactoryLibraryLoadMessage("Could not load wavetable catalog", synthView.catalogError);
        }

        if (synthView.runtimePresentation.failureMessage) {
            return synthView.runtimePresentation.failureMessage;
        }

        if (
            synthView.runtimePresentation.isPendingSelection &&
            synthView.desiredTableName !== synthView.displayedTableName
        ) {
            return `Loading ${synthView.desiredTableName}…`;
        }

        if (!synthView.frames) {
            return "Loading wavetable bank…";
        }

        return `${synthView.displayedFrameCount} shapes`;
    }, [
        synthView.catalogError,
        synthView.desiredTableName,
        synthView.displayedFrameCount,
        synthView.displayedTableName,
        synthView.frameError,
        synthView.frames,
        synthView.runtimePresentation.failureMessage,
        synthView.runtimePresentation.isPendingSelection,
    ]);

    const bankReadout = useMemo(() => {
        if (synthView.frameError) {
            return "Display unavailable";
        }

        if (synthView.runtimePresentation.failureMessage) {
            if (synthView.desiredTableName !== synthView.displayedTableName) {
                return `${synthView.displayedTableName} -> ${synthView.desiredTableName} • ${synthView.runtimePresentation.failureMessage}`;
            }

            return `${synthView.displayedTableName} • ${synthView.runtimePresentation.failureMessage}`;
        }

        if (
            synthView.runtimePresentation.isPendingSelection &&
            synthView.desiredTableName !== synthView.displayedTableName
        ) {
            return `${synthView.displayedTableName} -> ${synthView.desiredTableName}`;
        }

        return synthView.displayedTableName;
    }, [
        synthView.desiredTableName,
        synthView.displayedTableName,
        synthView.frameError,
        synthView.runtimePresentation.failureMessage,
        synthView.runtimePresentation.isPendingSelection,
    ]);

    const tableErrorText = synthView.runtimePresentation.failureMessage ? synthView.failureDetail : null;
    const shouldShowOverlay = !synthView.frames || Boolean(synthView.frameError || synthView.catalogError);

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

    return (
        <div className="ios-shell" style={shellStyle}>
            <div className="ios-top-row">
                <div
                    className="ios-main-view"
                    data-hidden={isMsegModalOpen ? "true" : "false"}
                    aria-hidden={isMsegModalOpen ? "true" : "false"}
                >
                    <div className="ios-scroll">
                        <div className="ios-content">
                            <IOSWavetablePanel
                                stageRef={stageRef}
                                frames={synthView.frames}
                                observedPosition={synthView.observedPosition}
                                warpMode={synthView.observedWarpState.hasActive ? synthView.observedWarpState.mode : synthView.warpMode.value}
                                warpAmount={synthView.observedWarpState.hasActive ? synthView.observedWarpState.amount : synthView.warpAmount.value}
                                displayedFrameCount={synthView.displayedFrameCount}
                                displayedTableIndex={synthView.displayedTableIndex}
                                desiredTableIndex={synthView.desiredTableIndex}
                                tableOptions={synthView.tableOptions}
                                shouldShowOverlay={shouldShowOverlay}
                                displayStatus={displayStatus}
                                tableErrorText={tableErrorText}
                                bankReadout={bankReadout}
                                canRetryDesiredTableLoad={synthView.canRetryDesiredTableLoad}
                                wavetableFocusBindings={synthView.keyboardRouting.wavetableFocusBindings}
                                wavetablePosition={synthView.wavetablePosition}
                                onSelectWavetable={handleSelectWavetable}
                                onRetryLoad={synthView.handleRetryLoad}
                            />

                            <IOSPlayPanel
                                playModeValue={synthView.playMode.value}
                                onPlayModeChange={synthView.playMode.commitValue}
                                playModeFocusBindings={synthView.keyboardRouting.playModeFocusBindings}
                                glideValue={synthView.glideTime.value}
                                onGlideChange={synthView.glideTime.commitValue}
                                glideFocusTarget={synthView.keyboardRouting.glideFocusTarget}
                            />

                            <IOSDistortionPanel
                                driveValue={synthView.distortionDriveDb.value}
                                kneeValue={synthView.distortionKnee.value}
                                wetValue={synthView.distortionWet.value}
                                wetHPHzValue={synthView.distortionWetHPHz.value}
                                wetLPHzValue={synthView.distortionWetLPHz.value}
                                scopeFrame={synthView.observedDistortionScope}
                                onDriveChange={synthView.distortionDriveDb.commitValue}
                                onKneeChange={synthView.distortionKnee.commitValue}
                                onWetChange={synthView.distortionWet.commitValue}
                                onWetHPHzChange={synthView.distortionWetHPHz.commitValue}
                                onWetLPHzChange={synthView.distortionWetLPHz.commitValue}
                            />

                            <IOSMsegLauncher
                                msegState={synthView.msegState}
                                selectedMsegSlot={synthView.selectedMsegSlot}
                                previewOrientation={msegPreviewOrientation}
                                onOpenEditor={openMsegModal}
                                onToggleLoop={synthView.handleToggleMsegLoop}
                                panValue={synthView.pan.value}
                                onPanChange={synthView.pan.commitValue}
                                onSelectMsegSlot={synthView.handleSelectMsegSlot}
                            />

                            <IOSModulationMatrixPanel
                                selectedEnvelopeSlot={synthView.selectedEnvelopeSlot}
                                selectedEnvelope={synthView.selectedEnvelope}
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
                    msegState={synthView.msegState}
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
        </div>
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
