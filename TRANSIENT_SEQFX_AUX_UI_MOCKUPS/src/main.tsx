import { StrictMode, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";

import { CrusherEditor } from "./cmps/CrusherEditor";
import { StutterEnvelopeEditor } from "./cmps/StutterEnvelopeEditor";
import { AuxCurve, sampleAuxCurve, type AuxCurveShape } from "./cmps/AuxCurve";

import "./styles/editor-tokens.css";
import "./styles/editor-tick-slider.css";
import "./styles/crusher-editor.css";
import "./styles/stutter-envelope-editor.css";
import "./styles/app.css";

type State = {
    bits: number;
    bitsEnd: number;
    bitsMod: boolean;

    holdFrames: number;
    holdFramesEnd: number;
    holdFramesMod: boolean;

    driveDb: number;
    driveDbEnd: number;
    driveDbMod: boolean;

    slices: number;
    slicesEnd: number;
    slicesMod: boolean;

    speed: number;
    shape: number;
    gate: number;
    gateEnd: number;
    gateMod: boolean;

    speedEnd: number;
    speedMod: boolean;
};

const BRIEF_SCENARIO: State = {
    bits: 8, bitsEnd: 12, bitsMod: true,
    holdFrames: 1, holdFramesEnd: 1, holdFramesMod: false,
    driveDb: 0, driveDbEnd: 24, driveDbMod: true,
    slices: 8, slicesEnd: 8, slicesMod: false,
    speed: 1, shape: 0.55, gate: 1.0, gateEnd: 0.25, gateMod: true,
    speedEnd: 1, speedMod: false,
};

const BLANK_SCENARIO: State = {
    bits: 8, bitsEnd: 8, bitsMod: false,
    holdFrames: 1, holdFramesEnd: 1, holdFramesMod: false,
    driveDb: 0, driveDbEnd: 0, driveDbMod: false,
    slices: 8, slicesEnd: 8, slicesMod: false,
    speed: 1, shape: 0.55, gate: 0.68, gateEnd: 0.68, gateMod: false,
    speedEnd: 1, speedMod: false,
};

const HEAVY_SCENARIO: State = {
    bits: 4, bitsEnd: 16, bitsMod: true,
    holdFrames: 1, holdFramesEnd: 32, holdFramesMod: true,
    driveDb: 6, driveDbEnd: 36, driveDbMod: true,
    slices: 4, slicesEnd: 16, slicesMod: true,
    speed: 2, shape: 0.85, gate: 0.9, gateEnd: 0.1, gateMod: true,
    speedEnd: 0.5, speedMod: true,
};

function App() {
    const [state, setState] = useState<State>(BRIEF_SCENARIO);
    const [curveShape, setCurveShape] = useState<AuxCurveShape>("ease");
    const [phase, setPhase] = useState(0);

    const update = (patch: Partial<State>) => setState((prev) => ({ ...prev, ...patch }));

    const curvePhase = useMemo(() => sampleAuxCurve(curveShape, phase), [curveShape, phase]);

    return (
        <div className="app-shell">
            <header className="app-head">
                <h1>SeqFX Aux Envelope — Option 1 (Inline markers) · live prototype</h1>
                <p>
                    The real <code>CrusherEditor</code> and <code>StutterEnvelopeEditor</code>
                    components, copied into this directory and extended with a
                    <code>modulation</code> prop. <b>Click any control's name</b> (Bits,
                    Hold, Drive, Gate, Speed, Slices) to toggle modulation on/off —
                    the little <span className="inline-m-hint">M</span> badge lights
                    up yellow when active. Drag the cyan and coral cells to shape the
                    sweep, then scrub Phase below to audition it.
                </p>
            </header>

            <aside className="control-col">
                <div className="control-card">
                    <h2>Block Scenarios</h2>
                    <button type="button" className="scenario-btn" onClick={() => setState(BRIEF_SCENARIO)}>Brief example</button>
                    <button type="button" className="scenario-btn" onClick={() => setState(HEAVY_SCENARIO)}>Heavy sweep</button>
                    <button type="button" className="scenario-btn" onClick={() => setState(BLANK_SCENARIO)}>No mod</button>
                </div>

                <div className="control-card">
                    <h2>How To Play</h2>
                    <p style={{ margin: 0, color: "rgba(238,242,239,0.62)", fontSize: "11px", lineHeight: 1.5 }}>
                        Click a control's <b>name</b> (Bits / Hold / Drive / Gate / Slices /
                        Speed) to toggle modulation on or off — the M badge next to the
                        name shows the state at a glance. When modulation is on, drag
                        the <b>cyan cell</b> to move the start value and the <b>coral
                        cell</b> to move the end value; cells between are filled yellow.
                        Scrub <em>Phase</em> in the aux curve below to sweep the block
                        — the Crusher waveform preview and the Stutter envelope animate
                        through the swept range.
                    </p>
                </div>

                <div className="control-card">
                    <h2>Directional modulation</h2>
                    <p style={{ margin: 0, color: "rgba(238,242,239,0.62)", fontSize: "11px", lineHeight: 1.5 }}>
                        <b>Slices</b> is the only one-way param in the current DSP.
                        <code>startStutter</code> in <code>SeqFx.cmajor</code> pins
                        <code>stutterReadLength = blockFrames / startSliceCount</code>,
                        and playback wraps at that length. Mid-block we can only
                        subdivide further (shorter slices, higher count); making each
                        slice longer would read past the captured window. Its badge
                        shows <span className="inline-m-hint">M↑</span> and the end
                        cell clamps at or above the start cell as you drag. Bits,
                        Hold, Drive, Speed, Shape and Gate are all pure playback-time
                        params with no buffer constraint — they stay bidirectional.
                    </p>
                </div>
            </aside>

            <section className="inspector">
                <div className="inspector__head">
                    <span className="inspector__block-lbl">Block</span>
                    <span className="inspector__block-id">L2 · Step 05 · len 4</span>
                    <span className="inspector__aux-badge">Aux</span>
                </div>

                <div className="inspector__effect-title">Crusher</div>
                <CrusherEditor
                    value={{ bits: state.bits, holdFrames: state.holdFrames, driveDb: state.driveDb, mix: 1 }}
                    onBitsChange={(v) => update({ bits: v })}
                    onHoldFramesChange={(v) => update({ holdFrames: v })}
                    onDriveDbChange={(v) => update({ driveDb: v })}
                    modulation={{
                        phase: curvePhase,
                        bits: state.bitsMod ? { end: state.bitsEnd, onEndChange: (v) => update({ bitsEnd: v }) } : null,
                        holdFrames: state.holdFramesMod ? { end: state.holdFramesEnd, onEndChange: (v) => update({ holdFramesEnd: v }) } : null,
                        driveDb: state.driveDbMod ? { end: state.driveDbEnd, onEndChange: (v) => update({ driveDbEnd: v }) } : null,
                        onToggleBits: () => setState((prev) => ({ ...prev, bitsMod: !prev.bitsMod })),
                        onToggleHoldFrames: () => setState((prev) => ({ ...prev, holdFramesMod: !prev.holdFramesMod })),
                        onToggleDriveDb: () => setState((prev) => ({ ...prev, driveDbMod: !prev.driveDbMod })),
                    }}
                />

                <div className="inspector__effect-title">Stutter</div>
                <StutterEnvelopeEditor
                    value={{ slices: state.slices, speed: state.speed, shape: state.shape, gate: state.gate }}
                    onSlicesChange={(v) => update({ slices: v })}
                    onSpeedChange={(v) => update({ speed: v })}
                    onShapeChange={(v) => update({ shape: v })}
                    onGateChange={(v) => update({ gate: v })}
                    modulation={{
                        phase: curvePhase,
                        gate: state.gateMod ? { end: state.gateEnd, onEndChange: (v) => update({ gateEnd: v }) } : null,
                        slices: state.slicesMod ? {
                            end: state.slicesEnd,
                            onEndChange: (v) => update({ slicesEnd: v }),
                            direction: "up" as const,
                        } : null,
                        speed: state.speedMod ? { end: state.speedEnd, onEndChange: (v) => update({ speedEnd: v }) } : null,
                        onToggleGate: () => setState((prev) => ({ ...prev, gateMod: !prev.gateMod })),
                        onToggleSlices: () => setState((prev) => ({
                            ...prev,
                            slicesMod: !prev.slicesMod,
                            // When turning Slices mod on with no prior end, seed end = start (safe for up-only).
                            slicesEnd: !prev.slicesMod && prev.slicesEnd < prev.slices ? prev.slices : prev.slicesEnd,
                        })),
                        onToggleSpeed: () => setState((prev) => ({ ...prev, speedMod: !prev.speedMod })),
                    }}
                />

                <AuxCurve
                    shape={curveShape}
                    onShapeChange={setCurveShape}
                    phase={phase}
                    onPhaseChange={setPhase}
                />
            </section>
        </div>
    );
}

const rootEl = document.getElementById("root");
if (!rootEl) {
    throw new Error("root element missing");
}

createRoot(rootEl).render(
    <StrictMode>
        <App />
    </StrictMode>,
);
