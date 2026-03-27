import {
    loadFactoryBankCatalogFromPatch,
    loadFactoryBankFramesFromPatch,
    DEFAULT_VISIBLE_MIP_INDEX,
} from "./wavetable-bank.js";
import { CanvasWavetableDisplay } from "./wavetable-display.js";
import { computeResponsivePatchLayout, getLayoutCSSVariables } from "./responsive-layout.js";

const midiInputEndpointID = "midiIn";
const wavetablePositionEndpointID = "wavetablePosition";
const wavetableSelectEndpointID = "wavetableSelect";
const DISPLAY_POSITION_EPSILON = 0.000001;

const knobDefault = 0.0;

function clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
}

function clampDisplayPosition(value) {
    return clamp(Number(value) || 0, 0.0, 1.0);
}

export function displayPositionsMatch(left, right, epsilon = DISPLAY_POSITION_EPSILON) {
    return Math.abs(clampDisplayPosition(left) - clampDisplayPosition(right)) <= epsilon;
}

export function mapDisplayDragToPosition(startValue, startClientY, nextClientY, dragSpan) {
    const safeSpan = Math.max(1, Number(dragSpan) || 0);
    const delta = (Number(startClientY) || 0) - (Number(nextClientY) || 0);

    return clampDisplayPosition((Number(startValue) || 0) + (delta / safeSpan));
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

function formatOrdinal(value) {
    return String(value).padStart(2, "0");
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
        this.currentTableIndex = 0;
        this.currentFrameCount = 1;
        this.hasDisplayedValue = false;
        this.display = null;
        this.displayFramesCache = new Map();
        this.displayFramesLoading = new Set();
        this.factoryBankCatalog = null;
        this.resizeObserver = null;
        this.windowResizeListener = null;
        this.currentLayout = computeResponsivePatchLayout({
            width: this.options.platform === "ios" ? 393 : 1120,
            height: this.options.platform === "ios" ? 648 : 680,
            platform: this.options.platform,
        });
        this.keyboardStyle = "";
        this.keyboardNoteCount = 0;
        this.knobEndpointID = null;
        this.scanRailEndpointID = null;
        this.tableSelectEndpointID = null;
        this.activeDisplayDrag = null;

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

        if (this.handleTableParameterChange) {
            this.patchConnection.removeParameterListener(
                wavetableSelectEndpointID,
                this.handleTableParameterChange
            );
        }

        if (this.handleStatusUpdate) {
            this.patchConnection.removeStatusListener(this.handleStatusUpdate);
        }

        if (this.scanRailInput && this.handleScanRailInput) {
            this.scanRailInput.removeEventListener("input", this.handleScanRailInput);
            this.scanRailInput.removeEventListener("pointerdown", this.handleScanRailGestureStart);
            this.scanRailInput.removeEventListener("pointerup", this.handleScanRailGestureEnd);
            this.scanRailInput.removeEventListener("change", this.handleScanRailGestureEnd);
            this.stepDownButton?.removeEventListener("click", this.handleScanStepDown);
            this.stepUpButton?.removeEventListener("click", this.handleScanStepUp);
        }

        if (this.displayViewport && this.handleDisplayDragStart) {
            this.displayViewport.removeEventListener("pointerdown", this.handleDisplayDragStart);
            this.displayViewport.removeEventListener("pointermove", this.handleDisplayDragMove);
            this.displayViewport.removeEventListener("pointerup", this.handleDisplayDragEnd);
            this.displayViewport.removeEventListener("pointercancel", this.handleDisplayDragEnd);
        }

        if (this.tableSelect && this.handleTableSelectChange) {
            this.tableSelect.removeEventListener("change", this.handleTableSelectChange);
        }
    }

    initialiseView() {
        this.shadowRoot.innerHTML = this.getHTML();

        this.knobControlHost = this.shadowRoot.querySelector(".knob-control-host");
        this.valueReadout = this.shadowRoot.querySelector("[data-role='value-readout']");
        this.frameReadout = this.shadowRoot.querySelector("[data-role='frame-readout']");
        this.heroFrameReadout = this.shadowRoot.querySelector("[data-role='hero-frame-readout']");
        this.keyboardHost = this.shadowRoot.querySelector(".keyboard-host");
        this.hint = this.shadowRoot.querySelector(".hint");
        this.displayCanvas = this.shadowRoot.querySelector(".wavetable-canvas");
        this.displayViewport = this.shadowRoot.querySelector(".wavetable-stage");
        this.displayOverlay = this.shadowRoot.querySelector(".display-overlay");
        this.displayStatus = this.shadowRoot.querySelector("[data-role='display-status']");
        this.bankReadout = this.shadowRoot.querySelector(".bank-readout");
        this.scanRailInput = this.shadowRoot.querySelector(".scan-slider");
        this.stepDownButton = this.shadowRoot.querySelector(".step-down");
        this.stepUpButton = this.shadowRoot.querySelector(".step-up");
        this.tableSelect = this.shadowRoot.querySelector(".table-select");
        this.railLabelStart = this.shadowRoot.querySelector("[data-role='rail-label-start']");
        this.railLabelMid = this.shadowRoot.querySelector("[data-role='rail-label-mid']");
        this.railLabelEnd = this.shadowRoot.querySelector("[data-role='rail-label-end']");

        this.display = new CanvasWavetableDisplay(this.displayCanvas);

        this.handleParameterChange = (value) => this.setDisplayedValue(value);
        this.handleTableParameterChange = (value) => this.setSelectedTableIndex(value);
        this.handleStatusUpdate = (status) => this.handlePatchStatus(status);
        this.handleDisplayDragStart = (event) => this.beginDisplayDrag(event);
        this.handleDisplayDragMove = (event) => this.updateDisplayDrag(event);
        this.handleDisplayDragEnd = (event) => this.endDisplayDrag(event);
        this.handleTableSelectChange = () => {
            const nextIndex = Number(this.tableSelect?.value ?? 0);

            this.patchConnection.sendParameterGestureStart?.(wavetableSelectEndpointID);
            this.patchConnection.sendEventOrValue(wavetableSelectEndpointID, nextIndex);
            this.patchConnection.sendParameterGestureEnd?.(wavetableSelectEndpointID);
            this.setSelectedTableIndex(nextIndex);
        };

        if (this.tableSelect) {
            this.tableSelect.addEventListener("change", this.handleTableSelectChange);
        }

        if (this.displayViewport) {
            this.displayViewport.addEventListener("pointerdown", this.handleDisplayDragStart);
            this.displayViewport.addEventListener("pointermove", this.handleDisplayDragMove);
            this.displayViewport.addEventListener("pointerup", this.handleDisplayDragEnd);
            this.displayViewport.addEventListener("pointercancel", this.handleDisplayDragEnd);
        }

        this.applyResponsiveLayout(this.currentLayout, true);

        if (this.options.platform === "ios") {
            this.buildScanRail();
        } else {
            this.buildKnob();
        }

        this.buildKeyboard();
        this.installResizeObserver();
        this.setDisplayedValue(knobDefault);
        this.setDisplayState("loading", "Loading wavetable bank…");

        this.patchConnection.addParameterListener(
            wavetablePositionEndpointID,
            this.handleParameterChange
        );
        this.patchConnection.addParameterListener(
            wavetableSelectEndpointID,
            this.handleTableParameterChange
        );
        this.patchConnection.requestParameterValue(wavetablePositionEndpointID);
        this.patchConnection.requestParameterValue(wavetableSelectEndpointID);

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
            this.currentLayout.controlHeight !== nextLayout.controlHeight ||
            this.currentLayout.stageMinHeight !== nextLayout.stageMinHeight ||
            this.currentLayout.keyboardHeight !== nextLayout.keyboardHeight ||
            this.currentLayout.headerStacks !== nextLayout.headerStacks ||
            this.currentLayout.controlStyle !== nextLayout.controlStyle;

        this.currentLayout = nextLayout;
        this.toggleAttribute("stacked-header", nextLayout.headerStacks);

        Object.entries(getLayoutCSSVariables(nextLayout)).forEach(([key, value]) => {
            this.style.setProperty(key, value);
        });

        if (layoutChanged && this.keyboard) {
            this.syncKeyboardLayout();
        }
    }

    async ensureBankCatalogLoaded() {
        if (this.factoryBankCatalog) {
            return this.factoryBankCatalog;
        }

        this.factoryBankCatalog = await loadFactoryBankCatalogFromPatch(this.patchConnection);
        this.populateTableSelector();
        this.updateBankReadout();
        this.updateFrameReadouts();
        return this.factoryBankCatalog;
    }

    populateTableSelector() {
        if (!this.tableSelect || !this.factoryBankCatalog) {
            return;
        }

        this.tableSelect.innerHTML = "";

        this.factoryBankCatalog.tables.forEach((table, tableIndex) => {
            const option = document.createElement("option");
            option.value = String(tableIndex);
            option.textContent = table.name;
            this.tableSelect.appendChild(option);
        });

        this.currentTableIndex = clamp(
            this.currentTableIndex,
            0,
            this.factoryBankCatalog.tables.length - 1
        );
        this.tableSelect.value = String(this.currentTableIndex);
    }

    getSelectedTableMeta() {
        return this.factoryBankCatalog?.tables?.[this.currentTableIndex] ?? null;
    }

    updateBankReadout() {
        if (!this.bankReadout) {
            return;
        }

        const selectedTable = this.getSelectedTableMeta();
        if (!selectedTable) {
            this.bankReadout.textContent = this.options.platform === "ios"
                ? "Factory bank"
                : "Factory bank";
            return;
        }

        this.bankReadout.textContent = this.options.platform === "ios"
            ? selectedTable.name
            : `Factory bank • ${selectedTable.name}`;
    }

    updateFrameReadouts() {
        const safeFrameCount = Math.max(1, this.currentFrameCount);
        const frameIndex = Math.round(this.currentValue * Math.max(0, safeFrameCount - 1)) + 1;

        if (this.frameReadout) {
            this.frameReadout.textContent = formatOrdinal(frameIndex);
        }

        if (this.heroFrameReadout) {
            this.heroFrameReadout.textContent = `${formatOrdinal(frameIndex)}/${formatOrdinal(safeFrameCount)}`;
        }

        if (this.railLabelStart) {
            this.railLabelStart.textContent = `Shape ${formatOrdinal(1)}`;
        }

        if (this.railLabelMid) {
            this.railLabelMid.textContent = `Shape ${formatOrdinal(Math.max(1, Math.ceil(safeFrameCount / 2)))}`;
        }

        if (this.railLabelEnd) {
            this.railLabelEnd.textContent = `Shape ${formatOrdinal(safeFrameCount)}`;
        }
    }

    async loadDisplayFrames(tableIndex = this.currentTableIndex) {
        const cachedBank = this.displayFramesCache.get(tableIndex);
        if (cachedBank) {
            this.applyLoadedBank(cachedBank);
            return;
        }

        if (this.displayFramesLoading.has(tableIndex)) {
            return;
        }

        this.displayFramesLoading.add(tableIndex);
        this.setDisplayState("loading", "Loading wavetable bank…");

        try {
            const bank = await loadFactoryBankFramesFromPatch(this.patchConnection, { tableIndex });
            this.displayFramesCache.set(tableIndex, bank);

            if (tableIndex === this.currentTableIndex) {
                this.applyLoadedBank(bank);
            }
        } catch (error) {
            console.error(error);
            const detail = String(error?.message || error || "Unknown error");
            this.setDisplayState("error", `Could not load wavetable bank: ${detail}`);
            if (this.bankReadout) {
                this.bankReadout.textContent = this.options.platform === "ios"
                    ? "Display unavailable"
                    : `Display unavailable: ${detail}`;
            }
        } finally {
            this.displayFramesLoading.delete(tableIndex);
        }
    }

    applyLoadedBank(bank) {
        this.currentFrameCount = Math.max(1, Number(bank.frameCount) || 1);
        this.display.setFrames(bank.frames);
        this.display.setPosition(this.currentValue);
        this.updateFrameReadouts();
        this.updateBankReadout();
        this.setDisplayState(
            "loaded",
            this.options.platform === "ios"
                ? `${bank.frameCount} shapes`
                : `${bank.frameCount} frames • mip ${DEFAULT_VISIBLE_MIP_INDEX}`
        );
    }

    setSelectedTableIndex(value) {
        const maxTableIndex = this.factoryBankCatalog
            ? Math.max(0, this.factoryBankCatalog.tables.length - 1)
            : 255;
        const nextTableIndex = clamp(Math.round(Number(value) || 0), 0, maxTableIndex);

        if (this.tableSelect && this.tableSelect.value !== String(nextTableIndex)) {
            this.tableSelect.value = String(nextTableIndex);
        }

        if (nextTableIndex === this.currentTableIndex && this.displayFramesCache.has(nextTableIndex)) {
            return;
        }

        this.currentTableIndex = nextTableIndex;
        this.updateBankReadout();
        void this.loadDisplayFrames(nextTableIndex);
    }

    handlePatchStatus(status) {
        if (status?.error) {
            if (this.hint) {
                this.hint.textContent = "The patch failed to load.";
            }
            this.setDisplayState("error", "The patch failed to load.");
            return;
        }

        const endpointInfo = findParameterEndpointInfo(status, wavetablePositionEndpointID);
        const tableSelectInfo = findParameterEndpointInfo(status, wavetableSelectEndpointID);

        if (endpointInfo) {
            if (this.options.platform === "ios") {
                this.buildScanRail(endpointInfo);
            } else {
                this.buildKnob(endpointInfo);
            }
        }

        if (tableSelectInfo) {
            this.tableSelectEndpointID = tableSelectInfo.endpointID;
        }

        this.patchConnection.requestParameterValue(wavetablePositionEndpointID);
        this.patchConnection.requestParameterValue(wavetableSelectEndpointID);
        if (this.hint) {
            this.hint.textContent = this.options.platform === "ios"
                ? ""
                : "Click the keyboard once, then use A W S E D F T G Y H U J K to play notes from your computer keyboard.";
        }

        void this.ensureBankCatalogLoaded()
            .catch((error) => {
                console.error(error);
                const detail = String(error?.message || error || "Unknown error");
                this.setDisplayState("error", `Could not load wavetable catalog: ${detail}`);
            })
            .finally(() => this.loadDisplayFrames(this.currentTableIndex));
    }

    setDisplayState(state, message) {
        if (this.displayStatus) {
            this.displayStatus.textContent = message;
        }
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
        if (this.hint) {
            this.hint.textContent = this.options.platform === "ios" ? "" : "Connecting the keyboard to the synth…";
        }
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

    buildScanRail(endpointInfo = { endpointID: wavetablePositionEndpointID }) {
        if (!this.scanRailInput) {
            return;
        }

        const endpointID = endpointInfo.endpointID || wavetablePositionEndpointID;

        if (this.scanRailEndpointID === endpointID) {
            return;
        }

        if (this.handleScanRailInput) {
            this.scanRailInput.removeEventListener("input", this.handleScanRailInput);
            this.scanRailInput.removeEventListener("pointerdown", this.handleScanRailGestureStart);
            this.scanRailInput.removeEventListener("pointerup", this.handleScanRailGestureEnd);
            this.scanRailInput.removeEventListener("change", this.handleScanRailGestureEnd);
            this.stepDownButton?.removeEventListener("click", this.handleScanStepDown);
            this.stepUpButton?.removeEventListener("click", this.handleScanStepUp);
        }

        this.scanRailEndpointID = endpointID;
        this.handleScanRailInput = () => {
            const nextValue = clampDisplayPosition(this.scanRailInput.value);

            if (this.hasDisplayedValue && displayPositionsMatch(this.currentValue, nextValue)) {
                return;
            }

            this.patchConnection.sendEventOrValue(endpointID, nextValue);
            this.setDisplayedValue(nextValue);
        };
        this.handleScanRailGestureStart = () => {
            this.patchConnection.sendParameterGestureStart?.(endpointID);
        };
        this.handleScanRailGestureEnd = () => {
            this.patchConnection.sendParameterGestureEnd?.(endpointID);
        };
        this.handleScanStepDown = () => this.nudgeScanRail(-this.getFrameStepSize());
        this.handleScanStepUp = () => this.nudgeScanRail(this.getFrameStepSize());

        this.scanRailInput.addEventListener("input", this.handleScanRailInput);
        this.scanRailInput.addEventListener("pointerdown", this.handleScanRailGestureStart);
        this.scanRailInput.addEventListener("pointerup", this.handleScanRailGestureEnd);
        this.scanRailInput.addEventListener("change", this.handleScanRailGestureEnd);
        this.stepDownButton?.addEventListener("click", this.handleScanStepDown);
        this.stepUpButton?.addEventListener("click", this.handleScanStepUp);
    }

    getFrameStepSize() {
        return this.currentFrameCount > 1 ? 1.0 / (this.currentFrameCount - 1) : 1.0;
    }

    nudgeScanRail(amount) {
        if (!this.scanRailInput || !this.scanRailEndpointID) {
            return;
        }

        this.patchConnection.sendParameterGestureStart?.(this.scanRailEndpointID);
        this.scanRailInput.value = clamp((Number(this.scanRailInput.value) || 0) + amount, 0, 1).toFixed(3);
        this.handleScanRailInput?.();
        this.patchConnection.sendParameterGestureEnd?.(this.scanRailEndpointID);
    }

    getPrimaryPositionEndpointID() {
        return this.scanRailEndpointID || this.knobEndpointID || null;
    }

    commitDraggedDisplayPosition(nextValue) {
        const clampedValue = clampDisplayPosition(nextValue);
        const endpointID = this.getPrimaryPositionEndpointID();

        if (!endpointID) {
            return;
        }

        if (this.scanRailInput) {
            this.scanRailInput.value = clampedValue.toFixed(3);
            this.handleScanRailInput?.();
            return;
        }

        if (this.hasDisplayedValue && displayPositionsMatch(this.currentValue, clampedValue)) {
            return;
        }

        this.patchConnection.sendEventOrValue(endpointID, clampedValue);
        this.setDisplayedValue(clampedValue);
    }

    beginDisplayDrag(event) {
        const endpointID = this.getPrimaryPositionEndpointID();

        if (!endpointID || !this.displayViewport) {
            return;
        }

        if (event.button !== undefined && event.button !== 0) {
            return;
        }

        const bounds = this.displayViewport.getBoundingClientRect();
        this.activeDisplayDrag = {
            pointerId: event.pointerId,
            startClientY: event.clientY,
            endpointID,
            startValue: this.currentValue,
            dragSpan: bounds.height,
        };

        this.displayViewport.setPointerCapture?.(event.pointerId);
        this.patchConnection.sendParameterGestureStart?.(endpointID);
        event.preventDefault?.();
    }

    updateDisplayDrag(event) {
        if (!this.activeDisplayDrag || event.pointerId !== this.activeDisplayDrag.pointerId) {
            return;
        }

        const nextValue = mapDisplayDragToPosition(
            this.activeDisplayDrag.startValue,
            this.activeDisplayDrag.startClientY,
            event.clientY,
            this.activeDisplayDrag.dragSpan
        );

        this.commitDraggedDisplayPosition(nextValue);
        event.preventDefault?.();
    }

    endDisplayDrag(event) {
        if (!this.activeDisplayDrag || event.pointerId !== this.activeDisplayDrag.pointerId) {
            return;
        }

        this.displayViewport?.releasePointerCapture?.(event.pointerId);
        const { endpointID } = this.activeDisplayDrag;
        this.activeDisplayDrag = null;
        this.patchConnection.sendParameterGestureEnd?.(endpointID);
        event.preventDefault?.();
    }

    setDisplayedValue(value) {
        const nextValue = clampDisplayPosition(value);

        if (this.hasDisplayedValue && displayPositionsMatch(this.currentValue, nextValue)) {
            return;
        }

        this.hasDisplayedValue = true;
        this.currentValue = nextValue;
        if (this.valueReadout) {
            this.valueReadout.textContent = this.options.platform === "ios"
                ? nextValue.toFixed(3)
                : nextValue.toFixed(2);
        }
        this.updateFrameReadouts();

        if (this.scanRailInput && document.activeElement !== this.scanRailInput) {
            this.scanRailInput.value = nextValue.toFixed(3);
        }

        this.display?.setPosition(nextValue);
    }

    getHTML() {
        if (this.options.platform === "ios") {
            return this.getIOSHTML();
        }

        return this.getDesktopHTML();
    }

    getDesktopHTML() {
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
                    --cosimo-control-height: 150px;
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

                .table-picker {
                    display: grid;
                    gap: 4px;
                }

                .table-picker-label {
                    font-size: 10px;
                    letter-spacing: 0.08em;
                    text-transform: uppercase;
                    color: rgba(168, 180, 255, 0.68);
                }

                .table-select {
                    min-width: 180px;
                    border-radius: 10px;
                    border: 1px solid rgba(122, 142, 255, 0.28);
                    background: rgba(8, 11, 24, 0.98);
                    color: #eef2f5;
                    padding: 8px 10px;
                    font-size: 13px;
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
                    width: var(--cosimo-control-height);
                    height: calc(var(--cosimo-control-height) + 20px);
                    display: grid;
                    justify-items: center;
                    align-content: start;
                    gap: 8px;
                }

                .knob-control-host {
                    width: var(--cosimo-control-height);
                    height: var(--cosimo-control-height);
                    display: grid;
                    place-items: center;
                }

                .cosimo-knob.knob-container {
                    --knob-track-background-color: rgba(112, 128, 214, 0.28);
                    --knob-track-value-color: #f19335;
                    --knob-dial-border-color: rgba(196, 204, 255, 0.08);
                    --knob-dial-background-color: radial-gradient(circle at 32% 28%, #434f95 0%, #1d2450 42%, #090d1f 100%);
                    --knob-dial-tick-color: #ffd8a6;

                    width: var(--cosimo-control-height);
                    height: var(--cosimo-control-height);
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
                                <label class="table-picker">
                                    <span class="table-picker-label">Table</span>
                                    <select class="table-select"></select>
                                </label>
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
                                <div class="value-text" data-role="value-readout">0.00</div>
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

    getIOSHTML() {
        return `
            <style>
                * {
                    box-sizing: border-box;
                }

                :host {
                    display: block;
                    width: 100%;
                    min-height: 100%;
                    min-height: 100dvh;
                    height: auto;
                    overflow-x: hidden;
                    overscroll-behavior: none;
                    background:
                        radial-gradient(circle at top, rgba(78, 106, 142, 0.1), transparent 30%),
                        linear-gradient(180deg, rgba(255, 255, 255, 0.016), rgba(255, 255, 255, 0)),
                        linear-gradient(180deg, rgba(7, 9, 13, 0.96), rgba(7, 9, 13, 0.98));
                    color: #eef2f5;
                    font-family: "SF Pro Display", "SF Pro Text", -apple-system, BlinkMacSystemFont, "Avenir Next", sans-serif;
                    --cosimo-section-gap: 12px;
                    --cosimo-stage-min-height: 248px;
                    --cosimo-keyboard-height: 122px;
                    --cosimo-control-height: 54px;
                }

                .ios-shell {
                    width: 100%;
                    min-height: 100%;
                    min-height: 100dvh;
                    height: auto;
                    min-width: 0;
                    padding: max(10px, env(safe-area-inset-top)) 0 max(14px, env(safe-area-inset-bottom)) 0;
                    display: grid;
                    grid-template-rows: auto auto auto;
                    align-content: start;
                    gap: var(--cosimo-section-gap);
                }

                .hero,
                .scan-panel,
                .keyboard-panel {
                    min-width: 0;
                }

                .eyebrow,
                .section-label,
                .display-status,
                .bank-readout,
                .rail-labels,
                .mini-label {
                    font-family: "SF Mono", "IBM Plex Mono", Menlo, monospace;
                    letter-spacing: 0.16em;
                    text-transform: uppercase;
                }

                .eyebrow,
                .section-label,
                .mini-label {
                    font-size: 10px;
                    color: rgba(212, 220, 230, 0.34);
                }

                .hero {
                    display: grid;
                    min-width: 0;
                    gap: 8px;
                    padding-top: 10px;
                }

                .hero-head,
                .scan-head,
                .keyboard-head {
                    display: grid;
                    min-width: 0;
                    grid-template-columns: minmax(0, 1fr) auto;
                    gap: 8px;
                    align-items: end;
                    padding-left: max(16px, env(safe-area-inset-left));
                    padding-right: max(16px, env(safe-area-inset-right));
                }

                .hero-title,
                .scan-title {
                    display: grid;
                    min-width: 0;
                    gap: 4px;
                }

                .hero-title strong,
                .scan-title strong {
                    font-size: 17px;
                    letter-spacing: -0.04em;
                    font-weight: 600;
                }

                .display-status,
                .bank-readout,
                .position-label {
                    font-size: 10px;
                    color: rgba(212, 220, 230, 0.42);
                }

                .table-select-wrap {
                    padding-left: max(16px, env(safe-area-inset-left));
                    padding-right: max(16px, env(safe-area-inset-right));
                }

                .table-picker {
                    display: grid;
                    gap: 6px;
                }

                .table-select {
                    appearance: auto;
                    width: 100%;
                    min-height: 40px;
                    border-radius: 12px;
                    border: 1px solid rgba(255, 255, 255, 0.08);
                    background: rgba(10, 13, 18, 0.92);
                    color: #eef2f5;
                    padding: 0 12px;
                    font-size: 14px;
                }

                .hero-frame,
                .position-readout {
                    font-family: "SF Pro Display", "SF Pro Text", -apple-system, BlinkMacSystemFont, sans-serif;
                    font-weight: 600;
                    letter-spacing: -0.03em;
                    color: #87d7f5;
                }

                .hero-frame {
                    font-size: 12px;
                }

                .position-readout {
                    font-size: 22px;
                    line-height: 1;
                }

                .wavetable-stage {
                    position: relative;
                    width: 100%;
                    min-width: 0;
                    max-width: 100%;
                    min-height: var(--cosimo-stage-min-height);
                    aspect-ratio: 1.55 / 1;
                    border-radius: 18px;
                    overflow: hidden;
                    background:
                        radial-gradient(circle at 50% 22%, rgba(135, 215, 245, 0.08), transparent 24%),
                        radial-gradient(circle at 88% 18%, rgba(242, 184, 107, 0.09), transparent 16%),
                        linear-gradient(180deg, rgba(8, 11, 17, 0.9), rgba(6, 9, 14, 0.98));
                    touch-action: none;
                }

                .wavetable-stage::before {
                    content: "";
                    position: absolute;
                    inset: 0;
                    background:
                        linear-gradient(rgba(255, 255, 255, 0.026) 1px, transparent 1px),
                        linear-gradient(90deg, rgba(255, 255, 255, 0.026) 1px, transparent 1px);
                    background-size: 28px 28px;
                    opacity: 0.24;
                    pointer-events: none;
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
                    padding: 20px;
                    font-size: 13px;
                    color: rgba(255, 216, 172, 0.86);
                    background: rgba(4, 7, 18, 0.82);
                    backdrop-filter: blur(4px);
                }

                .display-overlay[hidden] {
                    display: none;
                }

                .stage-copy {
                    position: absolute;
                    inset: 0;
                    display: grid;
                    grid-template-rows: auto 1fr auto;
                    gap: 8px;
                    padding: 12px;
                    pointer-events: none;
                }

                .stage-copy-row {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    gap: 8px;
                }

                .stage-copy-row:last-child {
                    align-items: end;
                }

                .mini-label.active {
                    color: #87d7f5;
                }

                .mini-label.warm {
                    color: #f2b86b;
                }

                .scan-panel,
                .keyboard-panel {
                    display: grid;
                    min-width: 0;
                    gap: 10px;
                    padding-top: 10px;
                }

                .scan-rail-wrap {
                    display: grid;
                    min-width: 0;
                    gap: 8px;
                    padding-left: max(16px, env(safe-area-inset-left));
                    padding-right: max(16px, env(safe-area-inset-right));
                }

                .scan-rail-row {
                    display: grid;
                    min-width: 0;
                    grid-template-columns: auto minmax(0, 1fr) auto;
                    gap: 10px;
                    align-items: center;
                }

                .rail-button {
                    width: 34px;
                    height: 34px;
                    border: 0;
                    border-radius: 999px;
                    background: none;
                    color: rgba(236, 241, 247, 0.42);
                    display: grid;
                    place-items: center;
                    font-size: 16px;
                }

                .scan-rail {
                    position: relative;
                    min-width: 0;
                    height: var(--cosimo-control-height);
                    border-radius: 14px;
                    overflow: hidden;
                    background:
                        linear-gradient(180deg, rgba(255, 255, 255, 0.03), transparent),
                        linear-gradient(90deg, rgba(255, 255, 255, 0.035) 0, rgba(255, 255, 255, 0) 100%);
                }

                .scan-rail::before {
                    content: "";
                    position: absolute;
                    inset: 0;
                    background:
                        repeating-linear-gradient(
                            90deg,
                            transparent 0,
                            transparent calc(6.25% - 1px),
                            rgba(255, 255, 255, 0.08) calc(6.25% - 1px),
                            rgba(255, 255, 255, 0.08) 6.25%
                        );
                    opacity: 0.46;
                    pointer-events: none;
                }

                .scan-rail::after {
                    content: "";
                    position: absolute;
                    inset: 21px 14px;
                    border-radius: 999px;
                    background:
                        linear-gradient(90deg, rgba(255, 255, 255, 0.02), rgba(255, 255, 255, 0.1), rgba(255, 255, 255, 0.02));
                    pointer-events: none;
                }

                .scan-slider {
                    appearance: none;
                    position: absolute;
                    inset: 0;
                    width: 100%;
                    height: 100%;
                    margin: 0;
                    background: transparent;
                    cursor: pointer;
                }

                .scan-slider::-webkit-slider-runnable-track {
                    height: var(--cosimo-control-height);
                    background: transparent;
                }

                .scan-slider::-moz-range-track {
                    height: var(--cosimo-control-height);
                    background: transparent;
                    border: 0;
                }

                .scan-slider::-webkit-slider-thumb {
                    appearance: none;
                    width: 14px;
                    height: var(--cosimo-control-height);
                    border: 0;
                    border-radius: 0;
                    background:
                        linear-gradient(180deg, rgba(135, 215, 245, 0), rgba(135, 215, 245, 0.82) 24%, rgba(135, 215, 245, 0.82) 76%, rgba(135, 215, 245, 0)),
                        linear-gradient(180deg, rgba(255, 255, 255, 0.66), rgba(255, 255, 255, 0.14));
                    box-shadow:
                        0 0 0 1px rgba(255, 255, 255, 0.08),
                        0 0 20px rgba(135, 215, 245, 0.22);
                    margin-top: 0;
                }

                .scan-slider::-moz-range-thumb {
                    width: 14px;
                    height: var(--cosimo-control-height);
                    border: 0;
                    border-radius: 0;
                    background:
                        linear-gradient(180deg, rgba(135, 215, 245, 0), rgba(135, 215, 245, 0.82) 24%, rgba(135, 215, 245, 0.82) 76%, rgba(135, 215, 245, 0)),
                        linear-gradient(180deg, rgba(255, 255, 255, 0.66), rgba(255, 255, 255, 0.14));
                    box-shadow:
                        0 0 0 1px rgba(255, 255, 255, 0.08),
                        0 0 20px rgba(135, 215, 245, 0.22);
                }

                .rail-labels {
                    display: flex;
                    justify-content: space-between;
                    gap: 8px;
                    font-size: 10px;
                    color: rgba(212, 220, 230, 0.34);
                }

                .keyboard-head strong {
                    font-size: 15px;
                    font-weight: 600;
                    color: #eef2f5;
                    letter-spacing: -0.03em;
                }

                .keyboard-host {
                    min-width: 0;
                    min-height: var(--cosimo-keyboard-height);
                    display: grid;
                    align-items: stretch;
                    padding-left: max(16px, env(safe-area-inset-left));
                    padding-right: max(16px, env(safe-area-inset-right));
                }

                .keyboard {
                    width: 100%;
                    height: var(--cosimo-keyboard-height);
                    border-radius: 16px 16px 20px 20px;
                    overflow: hidden;
                    background:
                        linear-gradient(180deg, rgba(255, 255, 255, 0.025), transparent 18%),
                        linear-gradient(180deg, rgba(10, 13, 18, 0.68), rgba(7, 9, 13, 0.92));
                    padding: 8px 8px 10px;
                    touch-action: none;
                }
            </style>

            <div class="ios-shell">
                <div class="hero">
                    <div class="hero-head">
                        <div class="hero-title">
                            <div class="section-label">Wavetable</div>
                            <strong>Factory Bank</strong>
                        </div>

                        <div>
                            <div class="display-status" data-role="display-status">Frame</div>
                            <div class="hero-frame" data-role="hero-frame-readout">01/16</div>
                        </div>
                    </div>

                    <div class="wavetable-stage" data-state="loading">
                        <canvas class="wavetable-canvas"></canvas>
                        <div class="display-overlay">Loading wavetable bank…</div>
                        <div class="stage-copy">
                            <div class="stage-copy-row">
                                <div class="mini-label active">Wavescan</div>
                                <div class="mini-label warm">Frame scan</div>
                            </div>
                            <div></div>
                            <div class="stage-copy-row">
                                <div class="mini-label">3D field</div>
                                <div class="bank-readout">Factory bank</div>
                            </div>
                        </div>
                    </div>
                </div>

                <div class="scan-panel">
                    <div class="scan-head">
                        <div class="scan-title">
                            <div class="section-label">Primary control</div>
                            <strong>Frame Scan</strong>
                        </div>

                        <div>
                            <div class="position-label display-status">Position</div>
                            <div class="position-readout" data-role="value-readout">0.000</div>
                        </div>
                    </div>

                    <div class="table-select-wrap">
                        <label class="table-picker">
                            <span class="position-label">Table</span>
                            <select class="table-select"></select>
                        </label>
                    </div>

                    <div class="scan-rail-wrap">
                        <div class="scan-rail-row">
                            <button class="rail-button step-down" type="button" aria-label="Step down">&lsaquo;</button>
                            <div class="scan-rail">
                                <input class="scan-slider" type="range" min="0" max="1" step="0.001" value="0.000" />
                            </div>
                            <button class="rail-button step-up" type="button" aria-label="Step up">&rsaquo;</button>
                        </div>

                        <div class="rail-labels">
                            <span data-role="rail-label-start">Shape 01</span>
                            <span data-role="rail-label-mid">Shape 08</span>
                            <span data-role="rail-label-end">Shape 16</span>
                        </div>
                    </div>
                </div>

                <div class="keyboard-panel">
                    <div class="keyboard-head">
                        <div>
                            <div class="section-label">Keyboard</div>
                            <strong>Keyboard</strong>
                        </div>
                    </div>

                    <div class="keyboard-host"></div>
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
