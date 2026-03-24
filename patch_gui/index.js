import { loadFactoryBankFramesFromPatch, DEFAULT_VISIBLE_MIP_INDEX } from "./wavetable-bank.js";
import { CanvasWavetableDisplay } from "./wavetable-display.js";

const midiInputEndpointID = "midiIn";
const wavetablePositionEndpointID = "wavetablePosition";
const knobMin = 0.0;
const knobMax = 1.0;
const knobDefault = 0.0;
const knobArcLength = 184.0;
let CosimoKeyboard;

function clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
}

function remap(value, sourceMin, sourceMax, targetMin, targetMax) {
    return targetMin + ((value - sourceMin) * (targetMax - targetMin) / (sourceMax - sourceMin));
}

function registerCustomElement(name, elementClass) {
    if (!window.customElements.get(name)) {
        window.customElements.define(name, elementClass);
    }
}

function defineKeyboardElement(patchConnection) {
    if (!CosimoKeyboard) {
        CosimoKeyboard = class extends patchConnection.utilities.PianoKeyboard {
            constructor() {
                super({
                    naturalNoteWidth: 22,
                    accidentalWidth: 13,
                    accidentalPercentageHeight: 64,
                    pressedNoteColour: "#f56cb6",
                });
            }
        };

        registerCustomElement("cosimo-synth-keyboard", CosimoKeyboard);
    }
}

class CosimoSynthView extends HTMLElement {
    constructor(patchConnection) {
        super();

        this.patchConnection = patchConnection;
        this.currentValue = knobDefault;
        this.dragStartValue = knobDefault;
        this.dragStartY = 0;
        this.display = null;
        this.resizeObserver = null;

        this.attachShadow({ mode: "open" });
        defineKeyboardElement(patchConnection);

        try {
            this.initialiseView();
        } catch (error) {
            console.error(error);
            this.showError(error);
        }
    }

    disconnectedCallback() {
        window.removeEventListener("mousemove", this.handleMouseMove);
        window.removeEventListener("mouseup", this.handleMouseUp);
        this.resizeObserver?.disconnect();

        if (this.keyboard) {
            this.keyboard.removeEventListener("note-down", this.handleNoteDown);
            this.keyboard.removeEventListener("note-up", this.handleNoteUp);
        }

        this.patchConnection.removeParameterListener(
            wavetablePositionEndpointID,
            this.handleParameterChange
        );
        this.patchConnection.removeEndpointListener(midiInputEndpointID, this.handleIncomingMIDI);
    }

    getScaleFactorLimits() {
        return { minScale: 0.75, maxScale: 1.35 };
    }

    initialiseView() {
        this.shadowRoot.innerHTML = this.getHTML();

        this.knobElement = this.shadowRoot.querySelector(".knob-shell");
        this.knobTrack = this.shadowRoot.querySelector(".knob-track-value");
        this.knobDial = this.shadowRoot.querySelector(".knob-dial");
        this.valueText = this.shadowRoot.querySelector(".value-text");
        this.keyboardHost = this.shadowRoot.querySelector(".keyboard-host");
        this.hint = this.shadowRoot.querySelector(".hint");
        this.displayCanvas = this.shadowRoot.querySelector(".wavetable-canvas");
        this.displayViewport = this.shadowRoot.querySelector(".wavetable-stage");
        this.displayOverlay = this.shadowRoot.querySelector(".display-overlay");
        this.displayStatus = this.shadowRoot.querySelector(".display-status");
        this.bankReadout = this.shadowRoot.querySelector(".bank-readout");

        this.handleParameterChange = (value) => this.setDisplayedValue(value);
        this.handleIncomingMIDI = (message) => this.keyboard?.handleExternalMIDI(message.message);
        this.handleMouseMove = (event) => this.dragKnob(event);
        this.handleMouseUp = () => this.endKnobGesture();

        this.display = new CanvasWavetableDisplay(this.displayCanvas);
        this.installResizeObserver();
        this.buildKeyboard();
        this.bindKnob();
        this.setDisplayedValue(knobDefault);

        this.patchConnection.addParameterListener(
            wavetablePositionEndpointID,
            this.handleParameterChange
        );
        this.patchConnection.requestParameterValue(wavetablePositionEndpointID);
        this.patchConnection.addEndpointListener(midiInputEndpointID, this.handleIncomingMIDI);
        this.loadDisplayFrames();

        this.hasOnscreenKeyboard = true;
    }

    installResizeObserver() {
        const resize = () => {
            const bounds = this.displayViewport.getBoundingClientRect();
            this.display.resize(bounds.width, bounds.height, window.devicePixelRatio || 1);
        };

        if ("ResizeObserver" in window) {
            this.resizeObserver = new ResizeObserver(() => resize());
            this.resizeObserver.observe(this.displayViewport);
        } else {
            window.addEventListener("resize", resize);
        }

        requestAnimationFrame(resize);
    }

    async loadDisplayFrames() {
        this.setDisplayState("loading", "Loading wavetable bank…");

        try {
            const bank = await loadFactoryBankFramesFromPatch(this.patchConnection);
            this.display.setFrames(bank.frames);
            this.display.setPosition(this.currentValue);
            this.setDisplayState("loaded", `${bank.frameCount} frames • mip ${DEFAULT_VISIBLE_MIP_INDEX}`);
            this.bankReadout.textContent = `Factory bank • ${bank.frameCount} stored shapes`;
        } catch (error) {
            console.error(error);
            this.setDisplayState("error", "Could not load wavetable bank");
            this.bankReadout.textContent = "Display unavailable";
        }
    }

    setDisplayState(state, message) {
        this.displayStatus.textContent = message;
        this.displayViewport.dataset.state = state;
        this.displayOverlay.textContent = message;
        this.displayOverlay.hidden = state === "loaded";
    }

    showError(error) {
        const message = String(error?.stack || error);

        this.shadowRoot.innerHTML = `
            <style>
                :host {
                    display: block;
                    width: 100%;
                    height: 100%;
                    background: #140f12;
                    color: #ffd9d9;
                    font-family: Menlo, Monaco, monospace;
                }

                pre {
                    margin: 0;
                    padding: 16px;
                    white-space: pre-wrap;
                    word-break: break-word;
                }
            </style>
            <pre>${message}</pre>
        `;
    }

    buildKeyboard() {
        this.keyboard = new (window.customElements.get("cosimo-synth-keyboard"))();

        this.keyboard.classList.add("keyboard");
        this.keyboard.setAttribute("root-note", "48");
        this.keyboard.setAttribute("note-count", "25");

        this.handleNoteDown = (event) => this.sendNoteEvent(event.detail.note, true);
        this.handleNoteUp = (event) => this.sendNoteEvent(event.detail.note, false);

        this.keyboard.addEventListener("note-down", this.handleNoteDown);
        this.keyboard.addEventListener("note-up", this.handleNoteUp);

        this.keyboardHost.innerHTML = "";
        this.keyboardHost.appendChild(this.keyboard);

        requestAnimationFrame(() => {
            this.keyboard.shadowRoot?.querySelector(".note-holder")?.focus();
        });

        this.hint.textContent =
            "Click the keyboard once, then use A W S E D F T G Y H U J K to play notes from your computer keyboard.";
    }

    bindKnob() {
        this.knobElement.addEventListener("mousedown", (event) => this.beginKnobGesture(event));
        this.knobElement.addEventListener("wheel", (event) => {
            event.preventDefault();

            const delta = event.deltaY < 0 ? 0.02 : -0.02;
            const nextValue = clamp(this.currentValue + delta, knobMin, knobMax);

            this.patchConnection.sendParameterGestureStart(wavetablePositionEndpointID);
            this.patchConnection.sendEventOrValue(wavetablePositionEndpointID, nextValue);
            this.patchConnection.sendParameterGestureEnd(wavetablePositionEndpointID);
        });
        this.knobElement.addEventListener("dblclick", () => {
            this.patchConnection.sendParameterGestureStart(wavetablePositionEndpointID);
            this.patchConnection.sendEventOrValue(wavetablePositionEndpointID, knobDefault);
            this.patchConnection.sendParameterGestureEnd(wavetablePositionEndpointID);
        });
    }

    beginKnobGesture(event) {
        event.preventDefault();

        this.dragStartY = event.clientY;
        this.dragStartValue = this.currentValue;

        window.addEventListener("mousemove", this.handleMouseMove);
        window.addEventListener("mouseup", this.handleMouseUp);
        this.patchConnection.sendParameterGestureStart(wavetablePositionEndpointID);
    }

    dragKnob(event) {
        const nextValue = clamp(
            this.dragStartValue + ((this.dragStartY - event.clientY) / 240.0),
            knobMin,
            knobMax
        );

        this.patchConnection.sendEventOrValue(wavetablePositionEndpointID, nextValue);
    }

    endKnobGesture() {
        window.removeEventListener("mousemove", this.handleMouseMove);
        window.removeEventListener("mouseup", this.handleMouseUp);
        this.patchConnection.sendParameterGestureEnd(wavetablePositionEndpointID);
    }

    sendNoteEvent(note, isOn) {
        const controlByte = isOn ? 0x900000 : 0x800000;
        const velocity = 100;

        this.patchConnection.sendMIDIInputEvent(
            midiInputEndpointID,
            controlByte | (note << 8) | velocity
        );
    }

    setDisplayedValue(value) {
        const nextValue = clamp(Number(value) || 0, knobMin, knobMax);
        const rotation = remap(nextValue, knobMin, knobMax, -132, 132);
        const dashOffset = remap(nextValue, knobMin, knobMax, knobArcLength, 0);

        this.currentValue = nextValue;
        this.knobTrack.style.strokeDasharray = `${knobArcLength}`;
        this.knobTrack.style.strokeDashoffset = `${dashOffset}`;
        this.knobDial.style.transform = `rotate(${rotation}deg)`;
        this.valueText.textContent = nextValue.toFixed(2);
        this.display?.setPosition(nextValue);
    }

    getHTML() {
        return `
            <style>
                * {
                    box-sizing: border-box;
                    font-family: "Avenir Next", Avenir, sans-serif;
                }

                :host {
                    display: block;
                    width: 100%;
                    height: 100%;
                    background: #02040b;
                    color: #f3f0ff;
                }

                .panel {
                    width: 100%;
                    height: 100%;
                    padding: 18px;
                }

                .card {
                    width: 100%;
                    height: 100%;
                    border: 1px solid rgba(122, 142, 255, 0.18);
                    border-radius: 18px;
                    background: rgba(4, 7, 18, 0.96);
                    box-shadow:
                        0 24px 60px rgba(3, 6, 18, 0.48),
                        inset 0 1px 0 rgba(160, 173, 255, 0.08);
                    padding: 18px 18px 14px;
                    display: grid;
                    gap: 16px;
                    grid-template-rows: auto 1fr auto auto;
                }

                .header {
                    display: flex;
                    justify-content: space-between;
                    align-items: end;
                    gap: 16px;
                }

                .title {
                    font-size: 14px;
                    letter-spacing: 0.12em;
                    text-transform: uppercase;
                    color: #8da2ff;
                }

                .subtitle {
                    font-size: 22px;
                    line-height: 1;
                    color: #ffd8a6;
                    margin-top: 6px;
                }

                .display-status {
                    padding: 6px 10px;
                    border-radius: 999px;
                    background: rgba(73, 93, 186, 0.14);
                    color: #f56cb6;
                    font-size: 12px;
                    letter-spacing: 0.04em;
                    text-transform: uppercase;
                    box-shadow: inset 0 1px 0 rgba(160, 173, 255, 0.08);
                }

                .main-grid {
                    display: grid;
                    grid-template-columns: minmax(0, 1fr) 208px;
                    gap: 16px;
                    align-items: stretch;
                }

                .wavetable-panel {
                    min-width: 0;
                    border-radius: 16px;
                    border: 1px solid rgba(122, 142, 255, 0.12);
                    background: rgba(5, 8, 20, 0.94);
                    padding: 14px 14px 12px;
                    display: grid;
                    grid-template-rows: auto 1fr;
                    gap: 12px;
                }

                .wavetable-copy {
                    display: flex;
                    justify-content: flex-start;
                    align-items: baseline;
                    gap: 12px;
                    font-size: 12px;
                }

                .bank-readout {
                    color: rgba(255, 214, 165, 0.9);
                    letter-spacing: 0.08em;
                    text-transform: uppercase;
                }

                .wavetable-stage {
                    position: relative;
                    aspect-ratio: 1.9 / 1;
                    min-height: 280px;
                    border-radius: 12px;
                    overflow: hidden;
                    background: #04070f;
                    box-shadow:
                        inset 0 1px 0 rgba(149, 164, 255, 0.08),
                        inset 0 -30px 54px rgba(2, 4, 12, 0.44);
                }

                .wavetable-canvas {
                    width: 100%;
                    height: 100%;
                    display: block;
                }

                .display-overlay {
                    position: absolute;
                    inset: 0;
                    display: grid;
                    place-items: center;
                    text-align: center;
                    padding: 22px;
                    font-size: 13px;
                    letter-spacing: 0.06em;
                    text-transform: uppercase;
                    color: rgba(255, 216, 172, 0.86);
                    background: rgba(4, 7, 18, 0.82);
                    backdrop-filter: blur(4px);
                }

                .display-overlay[hidden] {
                    display: none;
                }

                .wavetable-stage[data-state="error"] .display-overlay {
                    color: #ffb0d5;
                }

                .control-panel {
                    border-radius: 16px;
                    border: 1px solid rgba(122, 142, 255, 0.12);
                    background: rgba(5, 8, 20, 0.78);
                    padding: 16px 12px 14px;
                    display: grid;
                    align-content: start;
                    justify-items: center;
                    gap: 14px;
                }

                .control-heading {
                    font-size: 12px;
                    letter-spacing: 0.1em;
                    text-transform: uppercase;
                    color: rgba(154, 170, 255, 0.78);
                }

                .knob-shell {
                    width: 150px;
                    height: 150px;
                    position: relative;
                    cursor: ns-resize;
                    user-select: none;
                    -webkit-user-select: none;
                }

                .knob-shell svg {
                    width: 100%;
                    height: 100%;
                }

                .knob-path {
                    fill: none;
                    stroke-width: 6;
                    stroke-linecap: round;
                }

                .knob-track-background {
                    stroke: rgba(112, 128, 214, 0.28);
                }

                .knob-track-value {
                    stroke: #f19335;
                }

                .knob-dial {
                    position: absolute;
                    inset: 23px;
                    border-radius: 50%;
                    background:
                        radial-gradient(circle at 32% 28%, #434f95 0%, #1d2450 42%, #090d1f 100%);
                    box-shadow:
                        inset 0 2px 10px rgba(196, 204, 255, 0.14),
                        inset 0 -10px 18px rgba(0, 0, 0, 0.42),
                        0 12px 24px rgba(4, 8, 20, 0.42);
                    display: grid;
                    place-items: start center;
                    padding-top: 12px;
                    transition: transform 0.03s linear;
                }

                .knob-tick {
                    width: 4px;
                    height: 27px;
                    border-radius: 999px;
                    background: linear-gradient(180deg, #ffd9a4 0%, #f56cb6 100%);
                    box-shadow: 0 0 12px rgba(245, 108, 182, 0.48);
                }

                .value-text {
                    position: absolute;
                    inset: 0;
                    display: grid;
                    place-items: center;
                    padding-top: 38px;
                    font-size: 18px;
                    letter-spacing: 0.08em;
                    color: #ffd8a6;
                    pointer-events: none;
                }

                .label {
                    position: absolute;
                    inset: auto 0 12px 0;
                    text-align: center;
                    font-size: 13px;
                    letter-spacing: 0.08em;
                    text-transform: uppercase;
                    color: rgba(203, 212, 255, 0.8);
                    pointer-events: none;
                }

                .keyboard-host {
                    min-height: 122px;
                    display: grid;
                    align-items: stretch;
                }

                .keyboard {
                    width: 100%;
                    height: 122px;
                    border-radius: 12px;
                    overflow: hidden;
                    background: rgba(6, 10, 24, 0.94);
                    padding: 8px 10px 10px;
                }

                .hint {
                    font-size: 12px;
                    color: rgba(194, 202, 255, 0.72);
                }

                @media (max-width: 760px) {
                    .main-grid {
                        grid-template-columns: 1fr;
                    }
                }
            </style>

            <div class="panel">
                <div class="card">
                    <div class="header">
                        <div>
                            <div class="title">Cosimo Synth</div>
                            <div class="subtitle">Wavetable Position</div>
                        </div>
                        <div class="display-status">Loading wavetable bank…</div>
                    </div>

                    <div class="main-grid">
                        <div class="wavetable-panel">
                            <div class="wavetable-copy">
                                <div class="bank-readout">Factory bank</div>
                            </div>
                            <div class="wavetable-stage" data-state="loading">
                                <canvas class="wavetable-canvas"></canvas>
                                <div class="display-overlay">Loading wavetable bank…</div>
                            </div>
                        </div>

                        <div class="control-panel">
                            <div class="control-heading">Frame Scan</div>
                            <div class="knob-shell">
                                <svg viewBox="0 0 100 100" aria-hidden="true">
                                    <path
                                        class="knob-path knob-track-background"
                                        d="M20,76 A 40 40 0 1 1 80 76"
                                    ></path>
                                    <path
                                        class="knob-path knob-track-value"
                                        d="M20,76 A 40 40 0 1 1 80 76"
                                    ></path>
                                </svg>
                                <div class="knob-dial">
                                    <div class="knob-tick"></div>
                                </div>
                                <div class="value-text">0.00</div>
                                <div class="label">Wavetable Position</div>
                            </div>
                        </div>
                    </div>

                    <div class="keyboard-host"></div>
                    <div class="hint">Loading keyboard…</div>
                </div>
            </div>
        `;
    }
}

export default function createPatchView(patchConnection) {
    const tagName = "cosimo-synth-view";

    if (!window.customElements.get(tagName)) {
        window.customElements.define(tagName, CosimoSynthView);
    }

    return new (window.customElements.get(tagName))(patchConnection);
}
