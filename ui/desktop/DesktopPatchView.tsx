import {
    useCallback,
    useRef,
    useState,
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
    MsegOverviewSection,
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
import {
    useSynthPatchViewModel,
} from "../shared/synth-hooks";
import {
    FILTER_SPECTRUM_RENDER_MODE_OPTIONS,
    cycleFilterSpectrumRenderMode,
    type FilterSpectrumRenderMode,
} from "../shared/filter-spectrum";

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

type HeaderProps = {
    statusText: string;
};

type VoiceGlideSectionProps = {
    playMode: PatchControlBinding<number>;
    glideTime: PatchControlBinding<number>;
};

type WarpSectionProps = {
    warpMode: PatchControlBinding<number>;
    warpAmount: PatchControlBinding<number>;
    warpMsegDepth: PatchControlBinding<number>;
};

type FilterSectionProps = {
    filterMode: PatchControlBinding<number>;
    filterCutoff: PatchControlBinding<number>;
    filterQ: PatchControlBinding<number>;
    filterMsegDepth: PatchControlBinding<number>;
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
};

type MsegEditorModalProps = {
    isOpen: boolean;
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

function formatBipolarWarpAmount(value: number) {
    const percentValue = Math.round((value - 0.5) * 200);
    return `${percentValue > 0 ? "+" : ""}${percentValue}%`;
}

function formatWarpAmount(mode: number, value: number) {
    if (mode === 1 || mode === 3 || mode === 4) {
        return formatBipolarWarpAmount(value);
    }

    return formatPercent(value);
}

function formatCutoffHz(value: number) {
    if (value >= 1000) {
        return `${(value / 1000).toFixed(2)} kHz`;
    }

    return `${Math.round(value)} Hz`;
}

function formatQ(value: number) {
    return value.toFixed(2);
}

function formatSignedOctaves(value: number) {
    return `${value > 0 ? "+" : ""}${value.toFixed(2)} oct`;
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

function WarpSection({
    warpMode,
    warpAmount,
    warpMsegDepth,
}: WarpSectionProps) {
    return (
        <section className="grid gap-4 rounded-[24px] border border-white/8 bg-white/[0.03] p-5">
            <div className="flex items-start justify-between gap-4">
                <div>
                    <div className="text-[11px] uppercase tracking-[0.22em] text-cyan-300/70">Phase Warp</div>
                    <div className="mt-2 text-sm text-slate-300/75">
                        Remap oscillator phase before the wavetable lookup. The amount can also be driven per voice by MSEG 1.
                    </div>
                </div>
                <div className="rounded-full border border-cyan-300/15 bg-cyan-300/8 px-3 py-1 text-[10px] uppercase tracking-[0.18em] text-cyan-100/85">
                    Production Path
                </div>
            </div>

            <div className="grid gap-5 lg:grid-cols-[220px_minmax(0,1fr)_minmax(0,1fr)]">
                <label className="grid gap-2">
                    <span className="text-[11px] uppercase tracking-[0.18em] text-slate-300/60">Mode</span>
                    <div className="relative">
                        <select
                            aria-label="Warp mode"
                            className="h-11 w-full appearance-none rounded-[16px] border border-white/8 bg-black/25 px-4 pr-10 text-[11px] uppercase tracking-[0.16em] text-cyan-100 outline-none transition hover:border-cyan-200/30 focus:border-cyan-200/45"
                            value={String(warpMode.value)}
                            onChange={(event) => warpMode.commitValue(Number(event.target.value))}
                        >
                            {WARP_MODE_OPTIONS.map((option) => (
                                <option key={option.value} value={option.value}>
                                    {option.label}
                                </option>
                            ))}
                        </select>
                        <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-4 text-slate-300/75">
                            <svg className="h-3 w-3" viewBox="0 0 12 12" aria-hidden="true">
                                <path
                                    d="M3 4.5 6 7.5 9 4.5"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth="1.4"
                                />
                            </svg>
                        </div>
                    </div>
                </label>

                <RangeField
                    label="Amount"
                    min={0}
                    max={1}
                    step={0.001}
                    value={warpAmount.value}
                    displayValue={formatWarpAmount(warpMode.value, warpAmount.value)}
                    onChange={(nextValue) => warpAmount.commitValue(nextValue)}
                    ariaLabel="Warp amount"
                />

                <RangeField
                    label="MSEG 1 Depth"
                    min={-1}
                    max={1}
                    step={0.001}
                    value={warpMsegDepth.value}
                    displayValue={formatSignedPercent(warpMsegDepth.value)}
                    onChange={(nextValue) => warpMsegDepth.commitValue(nextValue)}
                    ariaLabel="Warp MSEG depth"
                />
            </div>
        </section>
    );
}

function FilterSection({
    filterMode,
    filterCutoff,
    filterQ,
    filterMsegDepth,
    observedFilterState,
    observedFilterSpectrum,
}: FilterSectionProps) {
    const [spectrumRenderMode, setSpectrumRenderMode] = useState<FilterSpectrumRenderMode>("graph");
    const selectedSpectrumMode = FILTER_SPECTRUM_RENDER_MODE_OPTIONS.find((option) => option.value === spectrumRenderMode)
        ?? FILTER_SPECTRUM_RENDER_MODE_OPTIONS[0];
    const normalizedCutoff = clamp(
        (Math.log(Math.max(20, filterCutoff.value)) - Math.log(20)) / (Math.log(20_000) - Math.log(20)),
        0,
        1,
    );
    const normalizedQ = clamp((filterQ.value - 0.1) / (20 - 0.1), 0, 1);

    return (
        <section className="grid gap-4 rounded-[24px] border border-white/8 bg-white/[0.03] p-5">
            <div className="flex items-start justify-between gap-4">
                <div>
                    <div className="text-[11px] uppercase tracking-[0.22em] text-sky-300/70">Filter</div>
                    <div className="mt-2 text-sm text-slate-300/75">
                        Apply a per-voice multimode filter after the oscillator and let the graph follow the newest active note.
                    </div>
                </div>
                <div className="rounded-full border border-sky-300/15 bg-sky-300/8 px-3 py-1 text-[10px] uppercase tracking-[0.18em] text-sky-100/85">
                    Live Response
                </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
                <div className="text-[11px] uppercase tracking-[0.18em] text-slate-300/60">Analyzer View</div>
                <div className="inline-flex rounded-full border border-white/8 bg-black/20 p-1">
                    {FILTER_SPECTRUM_RENDER_MODE_OPTIONS.map((option) => (
                        <button
                            key={option.value}
                            type="button"
                            aria-label={`Analyzer view ${option.label}`}
                            aria-pressed={spectrumRenderMode === option.value}
                            className={`rounded-full px-3 py-1 text-[10px] uppercase tracking-[0.18em] transition ${
                                spectrumRenderMode === option.value
                                    ? "bg-cyan-300/18 text-cyan-100"
                                    : "text-slate-300/65 hover:text-slate-100"
                            }`}
                            onClick={() => setSpectrumRenderMode(option.value)}
                        >
                            {option.label}
                        </button>
                    ))}
                </div>
                <button
                    type="button"
                    aria-label="Cycle analyzer view"
                    className="rounded-full border border-white/8 bg-black/20 px-3 py-2 text-[10px] uppercase tracking-[0.18em] text-slate-200/80 transition hover:border-cyan-200/35 hover:text-cyan-100"
                    onClick={() => setSpectrumRenderMode((previousMode) => cycleFilterSpectrumRenderMode(previousMode))}
                >
                    Cycle: {selectedSpectrumMode.label}
                </button>
            </div>

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
                onCutoffChange={(nextValue) => filterCutoff.commitValue(nextValue)}
                onQChange={(nextValue) => filterQ.commitValue(nextValue)}
            />

            <div className="grid gap-5 lg:grid-cols-[220px_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)]">
                <label className="grid gap-2">
                    <span className="text-[11px] uppercase tracking-[0.18em] text-slate-300/60">Mode</span>
                    <div className="relative">
                        <select
                            aria-label="Filter mode"
                            className="h-11 w-full appearance-none rounded-[16px] border border-white/8 bg-black/25 px-4 pr-10 text-[11px] uppercase tracking-[0.16em] text-cyan-100 outline-none transition hover:border-cyan-200/30 focus:border-cyan-200/45"
                            value={String(filterMode.value)}
                            onChange={(event) => filterMode.commitValue(Number(event.target.value))}
                        >
                            {FILTER_MODE_OPTIONS.map((option) => (
                                <option key={option.value} value={option.value}>
                                    {option.label}
                                </option>
                            ))}
                        </select>
                        <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-4 text-slate-300/75">
                            <svg className="h-3 w-3" viewBox="0 0 12 12" aria-hidden="true">
                                <path
                                    d="M3 4.5 6 7.5 9 4.5"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth="1.4"
                                />
                            </svg>
                        </div>
                    </div>
                </label>

                <RangeField
                    label="Cutoff"
                    min={0}
                    max={1}
                    step={0.001}
                    value={normalizedCutoff}
                    displayValue={formatCutoffHz(filterCutoff.value)}
                    onChange={(nextValue) => filterCutoff.commitValue(Math.exp(Math.log(20) + ((Math.log(20_000) - Math.log(20)) * nextValue)))}
                    ariaLabel="Filter cutoff"
                />

                <RangeField
                    label="Resonance"
                    min={0}
                    max={1}
                    step={0.001}
                    value={normalizedQ}
                    displayValue={formatQ(filterQ.value)}
                    onChange={(nextValue) => filterQ.commitValue(0.1 + ((20 - 0.1) * nextValue))}
                    ariaLabel="Filter resonance"
                />

                <RangeField
                    label="MSEG 1 Depth"
                    min={-6}
                    max={6}
                    step={0.001}
                    value={filterMsegDepth.value}
                    displayValue={formatSignedOctaves(filterMsegDepth.value)}
                    onChange={(nextValue) => filterMsegDepth.commitValue(nextValue)}
                    ariaLabel="Filter MSEG depth"
                />
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
                        <div className="text-[11px] uppercase tracking-[0.22em] text-blue-300/70">MSEG 1</div>
                        <div className="mt-2 text-2xl font-semibold tracking-[-0.04em] text-amber-100">Fixed Wavetable Route</div>
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

function DesktopPatchViewBody() {
    const stageRef = useRef<HTMLDivElement | null>(null);
    const msegEditorSurfaceRef = useRef<SVGSVGElement | null>(null);
    const keyboardElementRef = useRef<PianoKeyboardElement | null>(null);
    const [keyboardRootNote, setKeyboardRootNote] = useState(KEYBOARD_ROOT_NOTE_DEFAULT);
    const synthView = useSynthPatchViewModel({
        stageRef,
        msegEditorSurfaceRef,
        keyboardRef: keyboardElementRef,
        voiceModeCount: VOICE_MODE_OPTIONS.length,
    });

    const handleKeyboardOctaveDown = useCallback(() => {
        setKeyboardRootNote((previousRootNote) => Math.min(Math.max(previousRootNote - 12, KEYBOARD_ROOT_NOTE_MIN), KEYBOARD_ROOT_NOTE_MAX));
    }, []);

    const handleKeyboardOctaveUp = useCallback(() => {
        setKeyboardRootNote((previousRootNote) => Math.min(Math.max(previousRootNote + 12, KEYBOARD_ROOT_NOTE_MIN), KEYBOARD_ROOT_NOTE_MAX));
    }, []);

    return (
        <div className="cosimo-surface relative flex h-full w-full flex-col gap-5 overflow-hidden rounded-[28px] border border-white/8 p-6 text-slate-100 shadow-[0_26px_80px_rgba(0,0,0,0.48)]">
            <StatusHeader statusText={synthView.topStatus} />

            <main
                data-role="desktop-scroll-region"
                className="grid min-h-0 flex-1 grid-rows-[minmax(356px,0.9fr)_auto_auto] gap-5 overflow-x-hidden overflow-y-auto pr-1"
            >
                <section className="grid min-h-0 grid-cols-[minmax(280px,1fr)_minmax(0,2fr)] gap-5">
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
                        className="min-h-[356px]"
                    />

                    <MsegOverviewSection
                        msegState={synthView.msegState}
                        onOpenEditor={synthView.msegEditor.openEditor}
                        onDepthChange={synthView.handleMsegDepthChange}
                        onRateChange={synthView.handleMsegRateChange}
                        onToggleLoop={synthView.handleToggleMsegLoop}
                        depthFocusBindings={synthView.keyboardRouting.msegDepthFocusBindings}
                        rateFocusBindings={synthView.keyboardRouting.msegRateFocusBindings}
                        className="min-h-[356px]"
                    />
                </section>

                {synthView.failureDetail ? (
                    <div className="rounded-[22px] border border-fuchsia-300/15 bg-fuchsia-300/8 px-4 py-3 text-sm text-fuchsia-100/90">
                        {synthView.failureDetail}
                    </div>
                ) : null}

                <WarpSection
                    warpMode={synthView.warpMode}
                    warpAmount={synthView.warpAmount}
                    warpMsegDepth={synthView.warpMsegDepth}
                />

                <FilterSection
                    filterMode={synthView.filterMode}
                    filterCutoff={synthView.filterCutoff}
                    filterQ={synthView.filterQ}
                    filterMsegDepth={synthView.filterMsegDepth}
                    observedFilterState={synthView.observedFilterState}
                    observedFilterSpectrum={synthView.observedFilterSpectrum}
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
