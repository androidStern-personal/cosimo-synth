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
    return targetMin + (value - sourceMin) * (targetMax - targetMin) / (sourceMax - sourceMin);
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
                    pressedNoteColour: "#f0d17a",
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
        return { minScale: 0.75, maxScale: 1.5 };
    }

    initialiseView() {
        this.shadowRoot.innerHTML = this.getHTML();

        this.knobElement = this.shadowRoot.querySelector(".knob-shell");
        this.knobTrack = this.shadowRoot.querySelector(".knob-track-value");
        this.knobDial = this.shadowRoot.querySelector(".knob-dial");
        this.valueText = this.shadowRoot.querySelector(".value-text");
        this.keyboardHost = this.shadowRoot.querySelector(".keyboard-host");
        this.hint = this.shadowRoot.querySelector(".hint");

        this.handleParameterChange = (value) => this.setDisplayedValue(value);
        this.handleIncomingMIDI = (message) => this.keyboard?.handleExternalMIDI(message.message);
        this.handleMouseMove = (event) => this.dragKnob(event);
        this.handleMouseUp = () => this.endKnobGesture();

        this.buildKeyboard();
        this.bindKnob();
        this.setDisplayedValue(knobDefault);

        this.patchConnection.addParameterListener(
            wavetablePositionEndpointID,
            this.handleParameterChange
        );
        this.patchConnection.requestParameterValue(wavetablePositionEndpointID);
        this.patchConnection.addEndpointListener(midiInputEndpointID, this.handleIncomingMIDI);

        this.hasOnscreenKeyboard = true;
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
            this.dragStartValue + (this.dragStartY - event.clientY) / 240.0,
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
                    background:
                        radial-gradient(circle at top, #2f383f 0%, #15181b 58%, #0c0e10 100%);
                    color: #f3f3ee;
                }

                .panel {
                    width: 100%;
                    height: 100%;
                    padding: 18px;
                }

                .card {
                    width: 100%;
                    height: 100%;
                    border: 1px solid rgba(255, 255, 255, 0.12);
                    border-radius: 18px;
                    background: rgba(20, 23, 26, 0.82);
                    box-shadow: 0 18px 50px rgba(0, 0, 0, 0.35);
                    padding: 18px 18px 16px;
                    display: grid;
                    gap: 12px;
                    grid-template-rows: auto auto 1fr auto auto;
                }

                .title {
                    font-size: 14px;
                    letter-spacing: 0.12em;
                    text-transform: uppercase;
                    color: #c6d2c0;
                }

                .subtitle {
                    font-size: 20px;
                    line-height: 1;
                    color: #fff7d6;
                }

                .knob-section {
                    display: grid;
                    place-items: center;
                    min-height: 180px;
                }

                .knob-shell {
                    width: 168px;
                    height: 168px;
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
                    stroke: rgba(255, 255, 255, 0.14);
                }

                .knob-track-value {
                    stroke: #f0d17a;
                }

                .knob-dial {
                    position: absolute;
                    inset: 26px;
                    border-radius: 50%;
                    background:
                        radial-gradient(circle at 32% 28%, #4d5660 0%, #2c3137 48%, #15181c 100%);
                    box-shadow:
                        inset 0 2px 10px rgba(255, 255, 255, 0.08),
                        inset 0 -10px 18px rgba(0, 0, 0, 0.4),
                        0 12px 24px rgba(0, 0, 0, 0.28);
                    display: grid;
                    place-items: start center;
                    padding-top: 12px;
                    transition: transform 0.03s linear;
                }

                .knob-tick {
                    width: 4px;
                    height: 30px;
                    border-radius: 999px;
                    background: linear-gradient(180deg, #fff7d6 0%, #f0d17a 100%);
                    box-shadow: 0 0 10px rgba(240, 209, 122, 0.45);
                }

                .value-text {
                    position: absolute;
                    inset: 0;
                    display: grid;
                    place-items: center;
                    padding-top: 44px;
                    font-size: 19px;
                    letter-spacing: 0.08em;
                    color: #fff7d6;
                    pointer-events: none;
                }

                .label {
                    position: absolute;
                    inset: auto 0 12px 0;
                    text-align: center;
                    font-size: 13px;
                    letter-spacing: 0.08em;
                    text-transform: uppercase;
                    color: rgba(255, 255, 255, 0.76);
                    pointer-events: none;
                }

                .keyboard-host {
                    min-height: 126px;
                    display: grid;
                    align-items: stretch;
                }

                .keyboard {
                    width: 100%;
                    height: 126px;
                    border-radius: 12px;
                    overflow: hidden;
                    background: rgba(255, 255, 255, 0.04);
                    padding: 8px 10px 10px;
                }

                .hint {
                    font-size: 12px;
                    color: rgba(255, 255, 255, 0.68);
                }
            </style>

            <div class="panel">
                <div class="card">
                    <div class="title">Cosimo Synth Reload Test</div>
                    <div class="subtitle">Wavetable Position</div>
                    <div class="knob-section">
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
