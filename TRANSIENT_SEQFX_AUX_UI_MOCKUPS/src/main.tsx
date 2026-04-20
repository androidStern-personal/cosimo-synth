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
    slices: 8, speed: 1, shape: 0.55, gate: 1.0, gateEnd: 0.25, gateMod: true,
    speedEnd: 1, speedMod: false,
};

const BLANK_SCENARIO: State = {
    bits: 8, bitsEnd: 8, bitsMod: false,
    holdFrames: 1, holdFramesEnd: 1, holdFramesMod: false,
    driveDb: 0, driveDbEnd: 0, driveDbMod: false,
    slices: 8, speed: 1, shape: 0.55, gate: 0.68, gateEnd: 0.68, gateMod: false,
    speedEnd: 1, speedMod: false,
};

const HEAVY_SCENARIO: State = {
    bits: 4, bitsEnd: 16, bitsMod: true,
    holdFrames: 1, holdFramesEnd: 32, holdFramesMod: true,
    driveDb: 6, driveDbEnd: 36, driveDbMod: true,
    slices: 16, speed: 2, shape: 0.85, gate: 0.9, gateEnd: 0.1, gateMod: true,
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
                    <code>modulation</code> prop. Toggle per-param modulation on the
                    left, scrub the aux phase in the block curve below, and the
                    primary controls animate through their swept range (the wet
                    waveform preview and the Stutter envelope re-render live).
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
                    <h2>Modulation Enables</h2>
                    <div className="control-card__row">
                        <button type="button" className={`mod-check${state.bitsMod ? " is-on" : ""}`} onClick={() => update({ bitsMod: !state.bitsMod })} aria-label="Bits mod" />
                        <span>Bits</span>
                        <span>{state.bits} → {state.bitsEnd}</span>
                    </div>
                    <div className="control-card__row">
                        <button type="button" className={`mod-check${state.holdFramesMod ? " is-on" : ""}`} onClick={() => update({ holdFramesMod: !state.holdFramesMod })} aria-label="Hold mod" />
                        <span>Hold</span>
                        <span>{state.holdFrames} → {state.holdFramesEnd}</span>
                    </div>
                    <div className="control-card__row">
                        <button type="button" className={`mod-check${state.driveDbMod ? " is-on" : ""}`} onClick={() => update({ driveDbMod: !state.driveDbMod })} aria-label="Drive mod" />
                        <span>Drive</span>
                        <span>{state.driveDb.toFixed(1)} → {state.driveDbEnd.toFixed(1)} dB</span>
                    </div>
                    <div className="control-card__row">
                        <button type="button" className={`mod-check${state.gateMod ? " is-on" : ""}`} onClick={() => update({ gateMod: !state.gateMod })} aria-label="Gate mod" />
                        <span>Gate</span>
                        <span>{state.gate.toFixed(2)} → {state.gateEnd.toFixed(2)}</span>
                    </div>
                    <div className="control-card__row">
                        <button type="button" className={`mod-check${state.speedMod ? " is-on" : ""}`} onClick={() => update({ speedMod: !state.speedMod })} aria-label="Speed mod" />
                        <span>Speed</span>
                        <span>{state.speed.toFixed(2)}x → {state.speedEnd.toFixed(2)}x</span>
                    </div>
                </div>

                <div className="control-card">
                    <h2>How To Play</h2>
                    <p style={{ margin: 0, color: "rgba(238,242,239,0.62)", fontSize: "11px", lineHeight: 1.5 }}>
                        Drag the cyan marker (or thumb) on any row to set the start value. Drag
                        the coral marker for the end value. On the Stutter plot, the nearer of
                        the two gate handles captures your drag. Scrub <em>Phase</em> on the
                        aux curve below to sweep the block — the live sample dot follows the
                        curve and the effect preview animates.
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
                        speed: state.speedMod ? { end: state.speedEnd, onEndChange: (v) => update({ speedEnd: v }) } : null,
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
