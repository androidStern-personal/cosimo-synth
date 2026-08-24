import React, { useLayoutEffect, useMemo, useRef } from "react";

import { createDefaultMsegShape, renderMsegShape, sampleRenderedMsegBuffer } from "../../shared/mseg";
import { ParameterKnobArtwork, type ParameterKnobModRing } from "../../shared/parameter-knob-artwork";
import {
    formatRackParameterValue,
    getRackParameterDescriptor,
    type RackParameterDescriptor,
} from "../../shared/rack-parameter-descriptors";
import { SegmentedEditorTabs } from "../../shared/segmented-editor-tabs";
import {
    buildWavetableRenderModel,
    drawWavetableModel,
    type WavetableFrameInput,
} from "../../shared/wavetable-display";
import type { OscillatorID } from "../../shared/modulation-targets";
import { FingerOverlay } from "./finger-overlay";
import type { GestureScript } from "./gestures";
import type { SpeedrunVisualState } from "./state";

export type SpeedrunWavetableFrames = Readonly<Record<string, ReadonlyArray<WavetableFrameInput>>>;

const NOOP = () => undefined;
const VOICE_ACCENT = "#69d5c5";
const FX_ACCENT = "#a98cff";
const MOD_ACCENT = "#ff79d8";
const SOURCE_ACCENT = "#ffd36e";

const fallbackFrameCache = new Map<number, Float32Array[]>();

function clamp01(value: number) {
    return Math.min(1, Math.max(0, Number.isFinite(value) ? value : 0));
}

function createFallbackWavetableFrames(tableIndex: number) {
    const cached = fallbackFrameCache.get(tableIndex);
    if (cached !== undefined) return cached;
    const frames = Array.from({ length: 16 }, (_, frameIndex) => {
        const frame = new Float32Array(128);
        const morph = frameIndex / 15;
        const harmonic = 2 + (Math.abs(tableIndex) % 5);
        for (let sample = 0; sample < frame.length; sample += 1) {
            const phase = (sample / (frame.length - 1)) * Math.PI * 2;
            const fundamental = Math.sin(phase);
            const overtone = Math.sin(phase * harmonic + morph * Math.PI) * (0.35 + morph * 0.25);
            const folded = Math.asin(Math.sin(phase * (1 + morph * 2))) / (Math.PI / 2);
            frame[sample] = (fundamental * (1 - morph) + overtone * 0.52 + folded * morph * 0.42) * 0.72;
        }
        return frame;
    });
    fallbackFrameCache.set(tableIndex, frames);
    return frames;
}

function WavetableCanvas({
    tableIndex,
    tableName,
    position,
    warpMode,
    warpAmount,
    frameSets,
}: {
    readonly tableIndex: number;
    readonly tableName: string;
    readonly position: number;
    readonly warpMode: number;
    readonly warpAmount: number;
    readonly frameSets?: SpeedrunWavetableFrames;
}) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const frames = frameSets?.[tableName] ?? createFallbackWavetableFrames(tableIndex);
    const model = useMemo(() => buildWavetableRenderModel({
        frames: [...frames],
        position,
        warpMode,
        warpAmount,
        width: 357,
        height: 235,
        pixelRatio: 1,
    }), [frames, position, warpAmount, warpMode]);

    useLayoutEffect(() => {
        const context = canvasRef.current?.getContext("2d");
        if (context === null || context === undefined) return;
        drawWavetableModel(context, model, undefined, { paintBackground: false, showSliceCaption: false });
    }, [model]);

    return <canvas ref={canvasRef} className="speedrun-wavetable" width={357} height={235} aria-label={`${tableName} wavetable`} />;
}

function routeForTarget(state: SpeedrunVisualState, target: string) {
    const routeId = Object.entries(state.routeTargets).find(([, candidate]) => candidate === target)?.[0];
    if (routeId === undefined) return null;
    return state.routeAmounts[routeId] ?? 0;
}

function Knob({
    label,
    value,
    normalized,
    valueLabel,
    routeAmount = null,
    accent,
}: {
    readonly label: string;
    readonly value: number;
    readonly normalized: number;
    readonly valueLabel: string;
    readonly routeAmount?: number | null;
    readonly accent: string;
}) {
    const ring: ParameterKnobModRing = routeAmount === null
        ? { kind: "hidden" }
        : {
            kind: "mapped",
            lowNormalized: clamp01(normalized + Math.min(0, routeAmount * 0.18)),
            highNormalized: clamp01(normalized + Math.max(0, routeAmount * 0.18)),
            bypassed: false,
        };
    return (
        <div className="speedrun-knob" data-value={value.toFixed(6)}>
            <ParameterKnobArtwork
                className="speedrun-knob-art"
                baseNormalized={clamp01(normalized)}
                baseOriginNormalized={0}
                ownerAccent={accent}
                sourceAccent={SOURCE_ACCENT}
                modRing={ring}
                emphasis={routeAmount === null ? "base" : "modulation"}
            />
            <strong>{label}</strong>
            <span>{valueLabel}</span>
        </div>
    );
}

function Cell({ label, value, active = false }: { readonly label: string; readonly value: string; readonly active?: boolean }) {
    return (
        <div className={`speedrun-cell${active ? " is-active" : ""}`}>
            <span>{label}</span>
            <strong>{value}</strong>
            <i />
        </div>
    );
}

function voiceValue(state: SpeedrunVisualState, suffix: string, fallback: number) {
    return state.parameters[`osc${state.oscillatorId}${suffix}`] ?? fallback;
}

function VoicePanel({ state, frameSets }: { readonly state: SpeedrunVisualState; readonly frameSets?: SpeedrunWavetableFrames }) {
    const oscillator = state.oscillatorId;
    const tableName = state.wavetableNames[oscillator];
    const position = voiceValue(state, "WavetablePosition", 0);
    const warpMode = voiceValue(state, "WarpMode", 0);
    const warpAmount = voiceValue(state, "WarpAmount", 0);
    const cutoff = state.parameters.filterCutoff ?? 1_000;
    const resonance = state.parameters.filterQ ?? 0.8;
    const mix = state.parameters.filterMix ?? 1;
    const cutoffRoute = routeForTarget(state, "filterCutoffOctaves");
    return (
        <section className="speedrun-workspace speedrun-voice" data-panel="voice">
            <div className="speedrun-wavetable-card">
                <div className="speedrun-chip is-table">WT {tableName}</div>
                <div className="speedrun-chip is-warp">WARP {Math.round(warpMode)} / {Math.round(warpAmount * 100)}%</div>
                <WavetableCanvas
                    tableIndex={state.wavetableIndices[oscillator]}
                    tableName={tableName}
                    position={position}
                    warpMode={warpMode}
                    warpAmount={warpAmount}
                    frameSets={frameSets}
                />
                <div className="speedrun-cell-strip">
                    <Cell label="IDX" value={`${Math.round(position * 100)}%`} />
                    <Cell label="WARP" value={`${Math.round(warpAmount * 100)}%`} />
                    <Cell label="LVL" value={`${voiceValue(state, "VolumeDb", 0).toFixed(1)}dB`} />
                    <Cell label="DET" value={`${Math.round(voiceValue(state, "UnisonDetune", 0))}ct`} />
                </div>
            </div>
            <div className={`speedrun-filter-card${state.filterFocused ? " is-focused" : ""}`}>
                <svg viewBox="0 0 353 165" className="speedrun-filter-plot" aria-label="Filter response">
                    <defs>
                        <linearGradient id="speedrun-filter-fill" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0" stopColor="#c27df3" stopOpacity="0.44" />
                            <stop offset="1" stopColor="#c27df3" stopOpacity="0" />
                        </linearGradient>
                    </defs>
                    <path d="M 0 130 C 42 128, 70 26, 118 44 S 225 78, 353 80 L 353 165 L 0 165 Z" fill="url(#speedrun-filter-fill)" />
                    <path d="M 0 130 C 42 128, 70 26, 118 44 S 225 78, 353 80" fill="none" stroke="#c27df3" strokeWidth="3" />
                    <circle cx={Math.round(55 + clamp01(Math.log10(Math.max(20, cutoff) / 20) / 3) * 245)} cy="62" r="10" fill="#d68ef6" stroke="#f5dfff" strokeWidth="2" />
                </svg>
                <div className="speedrun-filter-knobs">
                    <Knob label="Cut" value={cutoff} normalized={Math.log10(Math.max(20, cutoff) / 20) / 3} valueLabel={`${Math.round(cutoff)}Hz`} routeAmount={cutoffRoute} accent="#c27df3" />
                    <Knob label="Res" value={resonance} normalized={clamp01(Math.log10(Math.max(0.1, resonance) / 0.1) / Math.log10(200))} valueLabel={resonance.toFixed(2)} accent="#c27df3" />
                    <Knob label="Mix" value={mix} normalized={mix} valueLabel={`${Math.round(mix * 100)}%`} accent="#c27df3" />
                </div>
            </div>
        </section>
    );
}

function effectLabel(deviceId: string) {
    const [raw, ordinal] = deviceId.split("#");
    const label = raw === "distortion" ? "Drive" : raw;
    return `${label} ${ordinal ?? ""}`.trim();
}

function normalizedRackValue(descriptor: RackParameterDescriptor, value: number) {
    if (descriptor.scale === "log") {
        return clamp01(Math.log(Math.max(descriptor.min, value) / descriptor.min)
            / Math.log(descriptor.max / descriptor.min));
    }
    return clamp01((value - descriptor.min) / Math.max(1e-9, descriptor.max - descriptor.min));
}

function FXPanel({ state }: { readonly state: SpeedrunVisualState }) {
    const selected = state.selectedDeviceId ?? state.laneDevices[0]?.deviceId ?? "delay#1";
    const parameters = Object.entries(state.laneParameters)
        .filter(([key]) => key.startsWith(`${selected}:`))
        .map(([key, value]) => ({ endpointID: key.slice(selected.length + 1), value }))
        .map((entry) => ({ ...entry, descriptor: getRackParameterDescriptor(entry.endpointID) }))
        .filter((entry): entry is typeof entry & { descriptor: RackParameterDescriptor } => entry.descriptor !== null)
        .slice(0, 6);
    const enabled = state.laneDevices.find((device) => device.deviceId === selected)?.enabled ?? false;
    return (
        <section className="speedrun-workspace speedrun-fx" data-panel="fx">
            <div className="speedrun-subway">
                {state.laneDevices.map((device, index) => (
                    <React.Fragment key={device.deviceId}>
                        {index > 0 ? <i /> : null}
                        <span className={device.deviceId === selected ? "is-selected" : ""}>{effectLabel(device.deviceId).slice(0, 3)}</span>
                    </React.Fragment>
                ))}
            </div>
            <div className="speedrun-fx-list">
                {state.laneDevices.map((device) => (
                    <div key={device.deviceId} className={device.deviceId === selected ? "is-selected" : ""}>
                        <span className={`speedrun-power${device.enabled ? " is-on" : ""}`} />
                        <strong>{effectLabel(device.deviceId)}</strong>
                        <small>{device.enabled ? "ACTIVE" : "BYPASSED"}</small>
                    </div>
                ))}
            </div>
            <div className={`speedrun-fx-editor${enabled ? " is-enabled" : ""}`}>
                <header><span>{enabled ? "SELECTED FX" : "FX BYPASSED"}</span><strong>{effectLabel(selected)}</strong></header>
                <div className="speedrun-fx-knobs">
                    {parameters.map(({ endpointID, value, descriptor }) => (
                        <Knob
                            key={endpointID}
                            label={descriptor.shortLabel}
                            value={value}
                            normalized={normalizedRackValue(descriptor, value)}
                            valueLabel={formatRackParameterValue(descriptor, value)}
                            routeAmount={routeForTarget(state, `lane.${selected}.${endpointID}`)}
                            accent={FX_ACCENT}
                        />
                    ))}
                </div>
            </div>
        </section>
    );
}

function msegPath(state: SpeedrunVisualState, slot: number) {
    const mseg = state.msegSlots[slot];
    const target = renderMsegShape(mseg?.shapeA ?? createDefaultMsegShape(`MSEG ${slot}`));
    const origin = renderMsegShape(createDefaultMsegShape(`MSEG ${slot}`));
    const progress = state.msegProgress[slot] ?? 0;
    const points = Array.from({ length: 72 }, (_, index) => {
        const x = index / 71;
        const from = sampleRenderedMsegBuffer(origin, x);
        const to = sampleRenderedMsegBuffer(target, x);
        const value = from + ((to - from) * progress);
        return `${(14 + x * 327).toFixed(2)},${(145 - clamp01(value) * 118).toFixed(2)}`;
    });
    return `M ${points.join(" L ")}`;
}

function ModPanel({ state }: { readonly state: SpeedrunVisualState }) {
    const source = state.selectedSourceId;
    const slot = Math.max(1, Number(source.match(/([1-4])$/)?.[1] ?? 1));
    const envelope = state.envelopes[slot] ?? DEFAULT_MOD_ENVELOPE;
    const macro = state.macros[slot] ?? { name: `Macro ${slot}`, value: 0 };
    const isMseg = source.startsWith("mseg");
    const isEnvelope = source.startsWith("env");
    return (
        <section className="speedrun-workspace speedrun-mod" data-panel="mod">
            <header><small>MODULATION SOURCE</small><strong>{isMseg ? `MSEG ${slot}` : isEnvelope ? envelope.name : macro.name}</strong></header>
            <div className="speedrun-source-tabs">
                {["MSEG", "ENV", "MACRO"].map((name) => <span key={name} className={source.toUpperCase().startsWith(name) ? "is-active" : ""}>{name}</span>)}
            </div>
            {isMseg ? (
                <div className="speedrun-mseg-card">
                    <svg viewBox="0 0 355 165" aria-label={`MSEG ${slot} shape`}>
                        <path d="M 14 145 H 341 M 14 86 H 341 M 14 27 H 341" stroke="rgba(125,247,255,.13)" strokeWidth="1" />
                        <path d={msegPath(state, slot)} fill="none" stroke={MOD_ACCENT} strokeWidth="4" strokeLinecap="round" />
                    </svg>
                    <div><Cell label="RATE" value={`${(state.parameters[`mseg${slot}Rate`] ?? 1).toFixed(2)}s`} /><Cell label="MORPH" value={`${Math.round((state.parameters[`mseg${slot}Morph`] ?? 0) * 100)}%`} /></div>
                </div>
            ) : isEnvelope ? (
                <div className="speedrun-envelope-card">
                    <svg viewBox="0 0 355 185" aria-label={`${envelope.name} envelope`}>
                        <path d={`M 12 165 L ${38 + envelope.attack * 180} 24 L ${100 + envelope.decay * 260} ${165 - envelope.sustain * 125} L 255 ${165 - envelope.sustain * 125} L ${342 - envelope.release * 80} 165`} fill="none" stroke={MOD_ACCENT} strokeWidth="5" />
                    </svg>
                    <div className="speedrun-envelope-values"><span>A {envelope.attack.toFixed(2)}</span><span>D {envelope.decay.toFixed(2)}</span><span>S {envelope.sustain.toFixed(2)}</span><span>R {envelope.release.toFixed(2)}</span></div>
                </div>
            ) : (
                <div className="speedrun-macro-card">
                    <Knob label={`Macro ${slot}`} value={macro.value} normalized={macro.value} valueLabel={`${Math.round(macro.value * 100)}%`} accent={MOD_ACCENT} />
                    <strong>{macro.name}</strong>
                </div>
            )}
            <div className="speedrun-route-list">
                {Object.entries(state.routeTargets).slice(0, 4).map(([routeId, target]) => (
                    <div key={routeId}><span>{source.toUpperCase()}</span><i>→</i><strong>{target.replace(/^lane\./, "").toUpperCase()}</strong><em>{(state.routeAmounts[routeId] ?? 0).toFixed(2)}</em></div>
                ))}
            </div>
        </section>
    );
}

const DEFAULT_MOD_ENVELOPE = { name: "Envelope", attack: 0.01, decay: 0.2, sustain: 0.8, release: 0.4 };

function Keyboard() {
    return (
        <div className="speedrun-keyboard" aria-hidden="true">
            {Array.from({ length: 10 }, (_, index) => <i key={index} className={index % 7 === 1 || index % 7 === 3 || index % 7 === 6 ? "is-black" : ""} />)}
        </div>
    );
}

export function SpeedrunPhoneUI({
    state,
    gesture,
    frameSets,
}: {
    readonly state: SpeedrunVisualState;
    readonly gesture: GestureScript | null;
    readonly frameSets?: SpeedrunWavetableFrames;
}) {
    const oscillatorTabs = (["A", "B", "C"] as const).map((id) => ({
        id,
        label: id,
        ariaLabel: `Oscillator ${id}`,
        dataRole: `speedrun-oscillator-${id}`,
    }));
    const workspaceTabs = (["voice", "fx", "mod"] as const).map((id) => ({
        id,
        label: id.toUpperCase(),
        ariaLabel: `${id} workspace`,
        dataRole: `speedrun-workspace-${id}`,
    }));
    return (
        <div className="speedrun-phone cosimo-surface" data-workspace={state.workspace}>
            <div className="speedrun-phone-status"><span>11:44</span><i /><b>67</b></div>
            <div className="speedrun-preset-bar"><span>INIT</span><i>•••</i></div>
            <SegmentedEditorTabs tabs={oscillatorTabs} activeId={state.oscillatorId} ariaLabel="Oscillators" dataRole="speedrun-oscillator-tabs" onSelect={NOOP} />
            <main>
                {state.workspace === "voice" ? <VoicePanel state={state} frameSets={frameSets} /> : null}
                {state.workspace === "fx" ? <FXPanel state={state} /> : null}
                {state.workspace === "mod" ? <ModPanel state={state} /> : null}
            </main>
            <div className="speedrun-workspace-tabs"><SegmentedEditorTabs tabs={workspaceTabs} activeId={state.workspace} ariaLabel="Workspaces" dataRole="speedrun-workspace-tabs" onSelect={NOOP} /></div>
            <div className="speedrun-mod-rail"><span>•••</span><b>2</b><i>⌘</i><strong>♪</strong></div>
            <Keyboard />
            <FingerOverlay gesture={gesture} />
        </div>
    );
}
