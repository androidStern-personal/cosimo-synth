import { loadFactoryBankFramesFromPatch, DEFAULT_VISIBLE_MIP_INDEX } from "./wavetable-bank.js";
import { CanvasWavetableDisplay } from "./wavetable-display.js";
import { computeResponsivePatchLayout, getLayoutCSSVariables } from "./responsive-layout.js";

const midiInputEndpointID = "midiIn";
const wavetablePositionEndpointID = "wavetablePosition";

const knobDefault = 0.0;

function clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
}

function registerCustomElement(name, elementClass) {
    if (!window.customElements.get(name)) {
        window.customElements.define(name, elementClass);
    }
}

function findParameterEndpointInfo(status, endpointID) {
    return status?.details?.inputs?.find(
        (endpointInfo) =>
            endpointInfo?.endpointID === endpointID &&
            endpointInfo?.purpose === "parameter"
    );
}

function getKeyboardTagName(keyboardStyle) {
    return `cosimo-synth-keyboard-${keyboardStyle}`;
}

function defineKeyboardElement(patchConnection, keyboardStyle, keyboardOptions) {
    const tagName = getKeyboardTagName(keyboardStyle);

    if (!window.customElements.get(tagName)) {
        const CosimoKeyboard = class extends patchConnection.utilities.PianoKeyboard {
            constructor() {
                super({
                    naturalNoteWidth: keyboardOptions.naturalNoteWidth,
                    accidentalWidth: keyboardOptions.accidentalWidth,
                    accidentalPercentageHeight: 64,
                    pressedNoteColour: "#f56cb6",
                });
            }
        };

        registerCustomElement(tagName, CosimoKeyboard);
    }

    return tagName;
}

class CosimoSynthView extends HTMLElement {
    constructor(patchConnection, options = {}) {
        super();

        this.patchConnection = patchConnection;
        this.options = { platform: "desktop", ...options };
        this.currentValue = knobDefault;
        this.display = null;
        this.displayFramesLoaded = false;
        this.displayFramesLoading = false;
        this.resizeObserver = null;
        this.windowResizeListener = null;
        this.currentLayout = computeResponsivePatchLayout({
            width: this.options.platform === "ios" ? 376 : 1120,
            height: this.options.platform === "ios" ? 648 : 680,
            platform: this.options.platform,
        });
        this.keyboardStyle = "";
        this.keyboardNoteCount = 0;

        this.attachShadow({ mode: "open" });

        try {
            this.initialiseView();
        } catch (error) {
            console.error(error);
            this.showError(error);
        }
    }

    disconnectedCallback() {
        this.resizeObserver?.disconnect();

        if (this.windowResizeListener) {
            window.removeEventListener("resize", this.windowResizeListener);
        }

        if (this.keyboard) {
            this.keyboard.detachPatchConnection?.(this.patchConnection);
        }

        if (this.handleParameterChange) {
            this.patchConnection.removeParameterListener(
                wavetablePositionEndpointID,
                this.handleParameterChange
            );
        }

        if (this.handleStatusUpdate) {
            this.patchConnection.removeStatusListener(this.handleStatusUpdate);
        }
    }

    initialiseView() {
        this.shadowRoot.innerHTML = this.getHTML();

        this.knobControlHost = this.shadowRoot.querySelector(".knob-control-host");
        this.valueText = this.shadowRoot.querySelector(".value-text");
        this.keyboardHost = this.shadowRoot.querySelector(".keyboard-host");
        this.hint = this.shadowRoot.querySelector(".hint");
        this.displayCanvas = this.shadowRoot.querySelector(".wavetable-canvas");
        this.displayViewport = this.shadowRoot.querySelector(".wavetable-stage");
        this.displayOverlay = this.shadowRoot.querySelector(".display-overlay");
        this.displayStatus = this.shadowRoot.querySelector(".display-status");
        this.bankReadout = this.shadowRoot.querySelector(".bank-readout");

        this.display = new CanvasWavetableDisplay(this.displayCanvas);

        this.handleParameterChange = (value) => this.setDisplayedValue(value);
        this.handleStatusUpdate = (status) => this.handlePatchStatus(status);

        this.applyResponsiveLayout(this.currentLayout, true);
        this.buildKnob();
        this.buildKeyboard();
        this.installResizeObserver();
        this.setDisplayedValue(knobDefault);
        this.setDisplayState("loading", "Loading wavetable bank…");

        this.patchConnection.addParameterListener(
            wavetablePositionEndpointID,
            this.handleParameterChange
        );
        this.patchConnection.requestParameterValue(wavetablePositionEndpointID);

        this.patchConnection.addStatusListener(this.handleStatusUpdate);
        this.patchConnection.requestStatusUpdate();
    }

    installResizeObserver() {
        const resize = () => {
            const hostBounds = this.getBoundingClientRect();
            const nextLayout = computeResponsivePatchLayout({
                width: hostBounds.width,
                height: hostBounds.height,
                platform: this.options.platform,
            });
            const stageBounds = this.displayViewport.getBoundingClientRect();

            this.applyResponsiveLayout(nextLayout);
            this.display.resize(stageBounds.width, stageBounds.height, window.devicePixelRatio || 1);
        };

        if ("ResizeObserver" in window) {
            this.resizeObserver = new ResizeObserver(() => resize());
            this.resizeObserver.observe(this);
            this.resizeObserver.observe(this.displayViewport);
        } else {
            this.windowResizeListener = () => resize();
            window.addEventListener("resize", this.windowResizeListener);
        }

        requestAnimationFrame(resize);
    }

    applyResponsiveLayout(nextLayout, force = false) {
        const layoutChanged =
            force ||
            this.currentLayout.gridTemplateColumns !== nextLayout.gridTemplateColumns ||
            this.currentLayout.noteCount !== nextLayout.noteCount ||
            this.currentLayout.knobSize !== nextLayout.knobSize ||
            this.currentLayout.stageMinHeight !== nextLayout.stageMinHeight ||
            this.currentLayout.keyboardHeight !== nextLayout.keyboardHeight ||
            this.currentLayout.headerStacks !== nextLayout.headerStacks;

        this.currentLayout = nextLayout;
        this.toggleAttribute("stacked-header", nextLayout.headerStacks);

        Object.entries(getLayoutCSSVariables(nextLayout)).forEach(([key, value]) => {
            this.style.setProperty(key, value);
        });

        if (layoutChanged && this.keyboard) {
            this.syncKeyboardLayout();
        }
    }

    async loadDisplayFrames() {
        if (this.displayFramesLoaded || this.displayFramesLoading) {
            return;
        }

        this.displayFramesLoading = true;

        try {
            const bank = await loadFactoryBankFramesFromPatch(this.patchConnection);
            this.display.setFrames(bank.frames);
            this.display.setPosition(this.currentValue);
            this.setDisplayState("loaded", `${bank.frameCount} frames • mip ${DEFAULT_VISIBLE_MIP_INDEX}`);
            this.bankReadout.textContent = `Factory bank • ${bank.frameCount} stored shapes`;
            this.displayFramesLoaded = true;
        } catch (error) {
            console.error(error);
            const detail = String(error?.message || error || "Unknown error");
            this.setDisplayState("error", `Could not load wavetable bank: ${detail}`);
            this.bankReadout.textContent = `Display unavailable: ${detail}`;
        } finally {
            this.displayFramesLoading = false;
        }
    }

    handlePatchStatus(status) {
        if (status?.error) {
            this.hint.textContent = "The patch failed to load.";
            return;
        }

        const endpointInfo = findParameterEndpointInfo(status, wavetablePositionEndpointID);

        if (endpointInfo) {
            this.buildKnob(endpointInfo);
        }

        this.patchConnection.requestParameterValue(wavetablePositionEndpointID);
        this.hint.textContent =
            "Click the keyboard once, then use A W S E D F T G Y H U J K to play notes from your computer keyboard.";

        if (!this.displayFramesLoaded) {
            this.loadDisplayFrames();
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
                    background: #02040b;
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

    getKeyboardStyle() {
        if (this.options.platform !== "ios") {
            return "desktop";
        }

        if (this.currentLayout.isCompact) {
            return "ios-compact";
        }

        if (this.currentLayout.keyboardHeight <= 92) {
            return "ios-short";
        }

        return "ios-regular";
    }

    buildKeyboard() {
        const keyboardStyle = this.getKeyboardStyle();
        const tagName = defineKeyboardElement(
            this.patchConnection,
            keyboardStyle,
            {
                naturalNoteWidth: this.currentLayout.keyboardNaturalNoteWidth,
                accidentalWidth: this.currentLayout.keyboardAccidentalWidth,
            }
        );

        this.keyboard = new (window.customElements.get(tagName))();
        this.keyboard.classList.add("keyboard");
        this.keyboard.setAttribute("root-note", "48");
        this.keyboard.setAttribute("note-count", `${this.currentLayout.noteCount}`);
        this.keyboard.attachToPatchConnection?.(this.patchConnection, midiInputEndpointID);
        this.keyboard.addEventListener("mousedown", () => this.focusKeyboard(), { passive: true });

        this.keyboardHost.innerHTML = "";
        this.keyboardHost.appendChild(this.keyboard);

        requestAnimationFrame(() => this.focusKeyboard());
        this.keyboardStyle = keyboardStyle;
        this.keyboardNoteCount = this.currentLayout.noteCount;
        this.hasOnscreenKeyboard = true;
        this.hint.textContent = "Connecting the keyboard to the synth…";
    }

    syncKeyboardLayout() {
        const nextStyle = this.getKeyboardStyle();
        const nextNoteCount = this.currentLayout.noteCount;

        if (this.keyboardStyle === nextStyle && this.keyboardNoteCount === nextNoteCount) {
            return;
        }

        this.keyboard.detachPatchConnection?.(this.patchConnection);
        this.buildKeyboard();
    }

    focusKeyboard() {
        this.keyboard?.shadowRoot?.querySelector(".note-holder")?.focus();
    }

    buildKnob(endpointInfo) {
        if (!endpointInfo) {
            return;
        }

        if (this.knobControl && this.knobEndpointID === endpointInfo.endpointID) {
            return;
        }

        const { Knob } = this.patchConnection.utilities.ParameterControls;
        this.knobControl = new Knob(this.patchConnection, endpointInfo);
        this.knobEndpointID = endpointInfo.endpointID;
        this.knobControl.classList.add("cosimo-knob");

        this.knobControlHost.innerHTML = "";
        this.knobControlHost.appendChild(this.knobControl);
    }

    setDisplayedValue(value) {
        const nextValue = clamp(Number(value) || 0, 0.0, 1.0);

        this.currentValue = nextValue;
        this.valueText.textContent = nextValue.toFixed(2);
        this.display?.setPosition(nextValue);
    }

    getHTML() {
        return `
            <style>
                ${this.patchConnection.utilities.ParameterControls.Knob.getCSS()}

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
                    --cosimo-panel-padding: 18px;
                    --cosimo-card-padding: 18px;
                    --cosimo-section-gap: 16px;
                    --cosimo-main-grid-columns: minmax(0, 1fr) 208px;
                    --cosimo-knob-size: 150px;
                    --cosimo-stage-min-height: 280px;
                    --cosimo-keyboard-height: 122px;
                    --cosimo-title-font-size: 14px;
                    --cosimo-subtitle-font-size: 22px;
                }

                .panel {
                    width: 100%;
                    height: 100%;
                    padding: var(--cosimo-panel-padding);
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
                    padding: var(--cosimo-card-padding);
                    display: grid;
                    gap: var(--cosimo-section-gap);
                    grid-template-rows: auto 1fr auto auto;
                }

                .header {
                    display: flex;
                    justify-content: space-between;
                    align-items: end;
                    gap: var(--cosimo-section-gap);
                }

                :host([stacked-header]) .header {
                    flex-direction: column;
                    align-items: flex-start;
                }

                .title {
                    font-size: var(--cosimo-title-font-size);
                    letter-spacing: 0.12em;
                    text-transform: uppercase;
                    color: #8da2ff;
                }

                .subtitle {
                    font-size: var(--cosimo-subtitle-font-size);
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
                    grid-template-columns: var(--cosimo-main-grid-columns);
                    gap: var(--cosimo-section-gap);
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
                    min-height: var(--cosimo-stage-min-height);
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
                    width: var(--cosimo-knob-size);
                    height: calc(var(--cosimo-knob-size) + 20px);
                    display: grid;
                    justify-items: center;
                    align-content: start;
                    gap: 8px;
                }

                .knob-control-host {
                    width: var(--cosimo-knob-size);
                    height: var(--cosimo-knob-size);
                    display: grid;
                    place-items: center;
                }

                .cosimo-knob.knob-container {
                    --knob-track-background-color: rgba(112, 128, 214, 0.28);
                    --knob-track-value-color: #f19335;
                    --knob-dial-border-color: rgba(196, 204, 255, 0.08);
                    --knob-dial-background-color: radial-gradient(circle at 32% 28%, #434f95 0%, #1d2450 42%, #090d1f 100%);
                    --knob-dial-tick-color: #ffd8a6;

                    width: var(--cosimo-knob-size);
                    height: var(--cosimo-knob-size);
                }

                .cosimo-knob .knob-path {
                    stroke-width: 6;
                }

                .cosimo-knob .knob-dial {
                    height: 70%;
                    width: 70%;
                    top: 50%;
                    left: 50%;
                    transform: translate(-50%, -50%);
                    border: none;
                    background: radial-gradient(circle at 32% 28%, #434f95 0%, #1d2450 42%, #090d1f 100%);
                    box-shadow:
                        inset 0 2px 10px rgba(196, 204, 255, 0.14),
                        inset 0 -10px 18px rgba(0, 0, 0, 0.42),
                        0 12px 24px rgba(4, 8, 20, 0.42);
                }

                .cosimo-knob .knob-dial-tick {
                    width: 4px;
                    height: 27px;
                    border-radius: 999px;
                    background: linear-gradient(180deg, #ffd9a4 0%, #f56cb6 100%);
                    box-shadow: 0 0 12px rgba(245, 108, 182, 0.48);
                    left: calc(50% - 2px);
                    top: 12px;
                }

                .value-text {
                    font-size: 18px;
                    letter-spacing: 0.08em;
                    color: #ffd8a6;
                    line-height: 1;
                }

                .label {
                    text-align: center;
                    font-size: 13px;
                    letter-spacing: 0.08em;
                    text-transform: uppercase;
                    color: rgba(203, 212, 255, 0.8);
                }

                .keyboard-host {
                    min-height: var(--cosimo-keyboard-height);
                    display: grid;
                    align-items: stretch;
                }

                .keyboard {
                    width: 100%;
                    height: var(--cosimo-keyboard-height);
                    border-radius: 12px;
                    overflow: hidden;
                    background: rgba(6, 10, 24, 0.94);
                    padding: 8px 10px 10px;
                    touch-action: none;
                }

                .hint {
                    font-size: 12px;
                    color: rgba(194, 202, 255, 0.72);
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
                                <div class="knob-control-host"></div>
                                <div class="value-text">0.00</div>
                                <div class="label">Wavetable Position</div>
                            </div>
                        </div>
                    </div>

                    <div class="keyboard-host"></div>
                    <div class="hint">Connecting the keyboard to the synth…</div>
                </div>
            </div>
        `;
    }
}

export function createPatchViewWithOptions(patchConnection, options = {}) {
    const tagName = "cosimo-synth-view";

    if (!window.customElements.get(tagName)) {
        window.customElements.define(tagName, CosimoSynthView);
    }

    return new (window.customElements.get(tagName))(patchConnection, options);
}

export default function createPatchView(patchConnection) {
    return createPatchViewWithOptions(patchConnection);
}
