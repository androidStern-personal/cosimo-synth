import {
    loadFactoryBankCatalogFromPatch,
    loadFactoryBankFramesFromPatch,
} from "./wavetable-bank.js";
import { MsegController } from "./mseg-controller.js";
import { evaluateMsegShape, findMsegPointHitIndex } from "./mseg.js";
import { CanvasWavetableDisplay } from "./wavetable-display.js";
import { computeResponsivePatchLayout, getLayoutCSSVariables } from "./responsive-layout.js";

const midiInputEndpointID = "midiIn";
const wavetablePositionEndpointID = "wavetablePosition";
const wavetableSelectEndpointID = "wavetableSelect";
const msegDepthEndpointID = "mseg1Depth";
const effectiveWavetablePositionEndpointID = "effectiveWavetablePosition";
const DISPLAY_POSITION_EPSILON = 0.000001;
const DISPLAY_GESTURE_AXIS_LOCK_PX = 12;
const DISPLAY_SWIPE_MIN_COMMIT_PX = 48;
const DISPLAY_SWIPE_COMMIT_RATIO = 0.18;
const DISPLAY_SLIDE_TRANSITION_MS = 240;
const SVG_NS = "http://www.w3.org/2000/svg";
const NOTE_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];

const knobDefault = 0.0;

function clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
}

function clampDisplayPosition(value) {
    return clamp(Number(value) || 0, 0.0, 1.0);
}

function clampDepth(value) {
    return clamp(Number(value) || 0, -1.0, 1.0);
}

function getPitchClass(noteNumber) {
    const safeNoteNumber = Math.round(Number(noteNumber) || 0);
    return ((safeNoteNumber % 12) + 12) % 12;
}

function isNaturalNoteNumber(noteNumber) {
    const pitchClass = getPitchClass(noteNumber);

    return pitchClass === 0 ||
        pitchClass === 2 ||
        pitchClass === 4 ||
        pitchClass === 5 ||
        pitchClass === 7 ||
        pitchClass === 9 ||
        pitchClass === 11;
}

export function countNaturalNotesInRange(rootNote, noteCount) {
    const safeRootNote = Math.round(Number(rootNote) || 0);
    const safeNoteCount = Math.max(1, Math.round(Number(noteCount) || 0));
    let naturalCount = 0;

    for (let noteOffset = 0; noteOffset < safeNoteCount; noteOffset += 1) {
        if (isNaturalNoteNumber(safeRootNote + noteOffset)) {
            naturalCount += 1;
        }
    }

    return Math.max(1, naturalCount);
}

export function computeKeyboardDimensions({
    rootNote = 36,
    noteCount = 24,
    availableWidth = 0,
    minNaturalWidth = 18,
} = {}) {
    const naturalCount = countNaturalNotesInRange(rootNote, noteCount);
    const safeAvailableWidth = Math.max(0, Number(availableWidth) || 0);
    const unclampedNaturalWidth = Math.max(1, (safeAvailableWidth - 1) / naturalCount);
    const naturalWidth = Math.max(Number(minNaturalWidth) || 0, unclampedNaturalWidth);
    const accidentalWidth = Math.max(8, naturalWidth * 0.58);

    return {
        naturalCount,
        naturalWidth,
        accidentalWidth,
    };
}

export function getAdjacentTableIndices(currentTableIndex, tableCount) {
    const safeTableCount = Math.max(0, Math.round(Number(tableCount) || 0));
    if (safeTableCount <= 1) {
        return [];
    }

    const safeCurrentIndex = clamp(
        Math.round(Number(currentTableIndex) || 0),
        0,
        safeTableCount - 1
    );
    const adjacent = [];

    if (safeCurrentIndex > 0) {
        adjacent.push(safeCurrentIndex - 1);
    }

    if (safeCurrentIndex < safeTableCount - 1) {
        adjacent.push(safeCurrentIndex + 1);
    }

    return adjacent;
}

export function resolveDisplayGestureAxis(deltaX, deltaY, axisLockThreshold = DISPLAY_GESTURE_AXIS_LOCK_PX) {
    const safeDeltaX = Math.abs(Number(deltaX) || 0);
    const safeDeltaY = Math.abs(Number(deltaY) || 0);
    const safeThreshold = Math.max(0, Number(axisLockThreshold) || 0);

    if (Math.max(safeDeltaX, safeDeltaY) < safeThreshold) {
        return "pending";
    }

    return safeDeltaX > safeDeltaY ? "horizontal" : "vertical";
}

export function resolveHorizontalSwipeTarget(startTableIndex, deltaX, tableCount) {
    const safeTableCount = Math.max(1, Math.round(Number(tableCount) || 1));
    const safeStartIndex = clamp(
        Math.round(Number(startTableIndex) || 0),
        0,
        safeTableCount - 1
    );
    const safeDeltaX = Number(deltaX) || 0;
    const direction = safeDeltaX < 0 ? 1 : safeDeltaX > 0 ? -1 : 0;

    if (direction === 0) {
        return {
            direction: 0,
            targetTableIndex: safeStartIndex,
            hasTarget: false,
        };
    }

    const targetTableIndex = clamp(safeStartIndex + direction, 0, safeTableCount - 1);
    return {
        direction,
        targetTableIndex,
        hasTarget: targetTableIndex !== safeStartIndex,
    };
}

export function shouldCommitHorizontalSwipe(
    deltaX,
    stageWidth,
    minCommitDistance = DISPLAY_SWIPE_MIN_COMMIT_PX,
    commitRatio = DISPLAY_SWIPE_COMMIT_RATIO
) {
    const safeStageWidth = Math.max(0, Number(stageWidth) || 0);
    const safeMinCommitDistance = Math.max(0, Number(minCommitDistance) || 0);
    const safeCommitRatio = Math.max(0, Number(commitRatio) || 0);
    const commitDistance = Math.max(safeMinCommitDistance, safeStageWidth * safeCommitRatio);

    return Math.abs(Number(deltaX) || 0) >= commitDistance;
}

function pointToEditorCoordinates(point, width, height) {
    return {
        x: point.x * width,
        y: (1.0 - point.y) * height,
    };
}

function editorCoordinatesToPoint(clientX, clientY, bounds) {
    const x = clamp((clientX - bounds.left) / Math.max(bounds.width, 1), 0.0, 1.0);
    const y = clamp(1.0 - ((clientY - bounds.top) / Math.max(bounds.height, 1)), 0.0, 1.0);
    return { x, y };
}

export function displayPositionsMatch(left, right, epsilon = DISPLAY_POSITION_EPSILON) {
    return Math.abs(clampDisplayPosition(left) - clampDisplayPosition(right)) <= epsilon;
}

export function mapDisplayDragToPosition(startValue, startClientY, nextClientY, dragSpan) {
    const safeSpan = Math.max(1, Number(dragSpan) || 0);
    const delta = (Number(startClientY) || 0) - (Number(nextClientY) || 0);

    return clampDisplayPosition((Number(startValue) || 0) + (delta / safeSpan));
}

export function normalizeEffectiveWavetablePositionMessage(message) {
    const payload = message?.event ?? message;

    if (payload === null || payload === undefined) {
        return null;
    }

    if (typeof payload === "number") {
        return {
            voiceGeneration: 0,
            position: clampDisplayPosition(payload),
        };
    }

    const rawPosition = Number(payload?.position);
    if (!Number.isFinite(rawPosition)) {
        return null;
    }

    const rawGeneration = Number(payload?.voiceGeneration);
    return {
        voiceGeneration: Number.isFinite(rawGeneration)
            ? Math.max(0, Math.trunc(rawGeneration))
            : 0,
        position: clampDisplayPosition(rawPosition),
    };
}

export function selectObservedWavetablePositionState(currentState, message) {
    const previousState = currentState && typeof currentState === "object"
        ? {
            voiceGeneration: Number.isFinite(Number(currentState.voiceGeneration))
                ? Math.trunc(Number(currentState.voiceGeneration))
                : -1,
            position: clampDisplayPosition(currentState.position),
        }
        : {
            voiceGeneration: -1,
            position: knobDefault,
        };
    const nextState = normalizeEffectiveWavetablePositionMessage(message);

    if (!nextState) {
        return previousState;
    }

    if (nextState.voiceGeneration < previousState.voiceGeneration) {
        return previousState;
    }

    return nextState;
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

            bindRenderedTouchHandlers() {
                for (const child of this.root.children) {
                    child.addEventListener("touchstart", (event) => this.touchStart(event), { passive: false });
                    child.addEventListener("touchend", (event) => this.touchEnd(event));
                }
            }

            attributeChangedCallback(name, oldValue, newValue) {
                super.attributeChangedCallback?.(name, oldValue, newValue);

                if (oldValue === newValue) {
                    return;
                }

                this.notes = [];
                this.refreshHTML();
                this.bindRenderedTouchHandlers();
                this.refreshActiveNoteElements();
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
        this.currentDisplayPosition = knobDefault;
        this.currentTableIndex = 0;
        this.currentFrameCount = 1;
        this.hasDisplayedValue = false;
        this.display = null;
        this.displaySlots = [];
        this.activeDisplaySlotIndex = 0;
        this.observedWavetablePositionState = {
            voiceGeneration: -1,
            position: knobDefault,
        };
        this.hasEffectiveWavetablePositionMonitor = false;
        this.displayFramesCache = new Map();
        this.displayFramesLoading = new Map();
        this.factoryBankCatalog = null;
        this.nextDisplaySelectionToken = 1;
        this.resizeObserver = null;
        this.windowResizeListener = null;
        this.currentLayout = computeResponsivePatchLayout({
            width: this.options.platform === "ios" ? 393 : 1120,
            height: this.options.platform === "ios" ? 648 : 680,
            platform: this.options.platform,
        });
        this.keyboardStyle = "";
        this.keyboardNoteCount = 0;
        this.keyboardRootNote = 36;
        this.keyboardMinRootNote = 12;
        this.keyboardMaxRootNote = 72;
        this.knobEndpointID = null;
        this.scanRailEndpointID = null;
        this.tableSelectEndpointID = null;
        this.activeDisplayDrag = null;
        this.msegController = null;
        this.msegState = null;
        this.selectedMsegPointIndex = 0;
        this.activeMsegDrag = null;

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

        if (this.handleEffectiveWavetablePositionChange && this.hasEffectiveWavetablePositionMonitor) {
            this.patchConnection.removeEndpointListener?.(
                effectiveWavetablePositionEndpointID,
                this.handleEffectiveWavetablePositionChange
            );
        }

        if (this.handleStatusUpdate) {
            this.patchConnection.removeStatusListener(this.handleStatusUpdate);
        }

        this.msegController?.detach();

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

        if (this.msegViewport && this.handleMsegPointerDown) {
            this.msegViewport.removeEventListener("pointerdown", this.handleMsegPointerDown);
            this.msegViewport.removeEventListener("pointermove", this.handleMsegPointerMove);
            this.msegViewport.removeEventListener("pointerup", this.handleMsegPointerUp);
            this.msegViewport.removeEventListener("pointercancel", this.handleMsegPointerUp);
        }

        if (this.msegDeleteButton && this.handleDeleteMsegPoint) {
            this.msegDeleteButton.removeEventListener("click", this.handleDeleteMsegPoint);
        }

        if (this.msegDepthInput && this.handleMsegDepthInput) {
            this.msegDepthInput.removeEventListener("input", this.handleMsegDepthInput);
        }

        if (this.octaveDownButton && this.handleOctaveDown) {
            this.octaveDownButton.removeEventListener("click", this.handleOctaveDown);
        }

        if (this.octaveUpButton && this.handleOctaveUp) {
            this.octaveUpButton.removeEventListener("click", this.handleOctaveUp);
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
        this.displayViewport = this.shadowRoot.querySelector(".wavetable-stage");
        this.displayLayers = Array.from(this.shadowRoot.querySelectorAll(".wavetable-layer"));
        this.displayCanvases = Array.from(this.shadowRoot.querySelectorAll(".wavetable-canvas"));
        this.displayOverlay = this.shadowRoot.querySelector(".display-overlay");
        this.displayStatus = this.shadowRoot.querySelector("[data-role='display-status']");
        this.bankReadout = this.shadowRoot.querySelector(".bank-readout");
        this.stageGestureHint = this.shadowRoot.querySelector("[data-role='stage-gesture-hint']");
        this.scanRailInput = this.shadowRoot.querySelector(".scan-slider");
        this.stepDownButton = this.shadowRoot.querySelector(".step-down");
        this.stepUpButton = this.shadowRoot.querySelector(".step-up");
        this.tableSelect = this.shadowRoot.querySelector(".table-select");
        this.bankPickerTrigger = this.shadowRoot.querySelector(".bank-picker-trigger");
        this.railLabelStart = this.shadowRoot.querySelector("[data-role='rail-label-start']");
        this.railLabelMid = this.shadowRoot.querySelector("[data-role='rail-label-mid']");
        this.railLabelEnd = this.shadowRoot.querySelector("[data-role='rail-label-end']");
        this.octaveDownButton = this.shadowRoot.querySelector(".octave-down");
        this.octaveUpButton = this.shadowRoot.querySelector(".octave-up");
        this.octaveReadout = this.shadowRoot.querySelector("[data-role='octave-readout']");
        this.msegViewport = this.shadowRoot.querySelector(".mseg-editor");
        this.msegCurve = this.shadowRoot.querySelector(".mseg-curve");
        this.msegPointsLayer = this.shadowRoot.querySelector(".mseg-points");
        this.msegDeleteButton = this.shadowRoot.querySelector(".mseg-delete-point");
        this.msegDepthInput = this.shadowRoot.querySelector(".mseg-depth-slider");
        this.msegDepthReadout = this.shadowRoot.querySelector("[data-role='mseg-depth-readout']");

        this.displaySlots = this.displayCanvases.map((canvas, slotIndex) => ({
            slotIndex,
            layer: this.displayLayers[slotIndex] ?? canvas,
            canvas,
            display: new CanvasWavetableDisplay(canvas),
            tableIndex: null,
            frameCount: 0,
        }));
        this.activeDisplaySlotIndex = 0;
        this.display = this.displaySlots[0]?.display ?? null;
        this.msegController = new MsegController(this.patchConnection, {
            onStateChange: (state) => this.handleMsegStateChange(state),
        });
        this.msegController.attach();

        this.handleParameterChange = (value) => this.setDisplayedValue(value);
        this.handleTableParameterChange = (value) => {
            void this.setSelectedTableIndex(value).catch(() => {});
        };
        this.handleEffectiveWavetablePositionChange = (message) => this.handleObservedDisplayPosition(message);
        this.handleStatusUpdate = (status) => this.handlePatchStatus(status);
        this.handleDisplayDragStart = (event) => this.beginDisplayDrag(event);
        this.handleDisplayDragMove = (event) => this.updateDisplayDrag(event);
        this.handleDisplayDragEnd = (event) => this.endDisplayDrag(event);
        this.handleMsegPointerDown = (event) => this.beginMsegInteraction(event);
        this.handleMsegPointerMove = (event) => this.updateMsegInteraction(event);
        this.handleMsegPointerUp = (event) => this.endMsegInteraction(event);
        this.handleDeleteMsegPoint = () => this.deleteSelectedMsegPoint();
        this.handleMsegDepthInput = () => {
            this.msegController?.setDepth(clampDepth(this.msegDepthInput?.value));
        };
        this.handleOctaveDown = () => this.nudgeKeyboardOctave(-12);
        this.handleOctaveUp = () => this.nudgeKeyboardOctave(12);
        this.handleTableSelectChange = () => {
            const nextIndex = Number(this.tableSelect?.value ?? 0);
            const animateDirection =
                Math.abs(nextIndex - this.currentTableIndex) === 1
                    ? Math.sign(nextIndex - this.currentTableIndex)
                    : 0;

            this.sendSelectedTableIndex(nextIndex);
            void this.setSelectedTableIndex(nextIndex, { animateDirection }).catch(() => {});
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

        if (this.msegViewport) {
            this.msegViewport.addEventListener("pointerdown", this.handleMsegPointerDown);
            this.msegViewport.addEventListener("pointermove", this.handleMsegPointerMove);
            this.msegViewport.addEventListener("pointerup", this.handleMsegPointerUp);
            this.msegViewport.addEventListener("pointercancel", this.handleMsegPointerUp);
        }

        this.msegDeleteButton?.addEventListener("click", this.handleDeleteMsegPoint);
        this.msegDepthInput?.addEventListener("input", this.handleMsegDepthInput);
        this.octaveDownButton?.addEventListener("click", this.handleOctaveDown);
        this.octaveUpButton?.addEventListener("click", this.handleOctaveUp);

        this.applyResponsiveLayout(this.currentLayout, true);

        if (this.options.platform === "ios") {
            this.buildScanRail();
        } else {
            this.buildKnob();
        }

        this.buildKeyboard();
        this.installResizeObserver();
        this.resetDisplayLayerPositions();
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
        if (typeof this.patchConnection.addEndpointListener === "function") {
            try {
                this.patchConnection.addEndpointListener(
                    effectiveWavetablePositionEndpointID,
                    this.handleEffectiveWavetablePositionChange
                );
                this.hasEffectiveWavetablePositionMonitor = true;
            } catch (error) {
                console.warn("Could not subscribe to effective wavetable position updates", error);
            }
        }
        this.patchConnection.requestParameterValue(wavetablePositionEndpointID);
        this.patchConnection.requestParameterValue(wavetableSelectEndpointID);

        this.patchConnection.addStatusListener(this.handleStatusUpdate);
        this.patchConnection.requestStatusUpdate();
        this.msegController.requestBootState();
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
            this.syncKeyboardGeometry();
            this.displaySlots.forEach((slot) => {
                slot.display.resize(stageBounds.width, stageBounds.height, window.devicePixelRatio || 1);
            });
            this.resetDisplayLayerPositions();
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

    getDisplayStageWidth() {
        return Math.max(
            1,
            this.displayViewport?.getBoundingClientRect?.().width ||
                this.displayViewport?.clientWidth ||
                1
        );
    }

    getActiveDisplaySlot() {
        return this.displaySlots[this.activeDisplaySlotIndex] ?? null;
    }

    getInactiveDisplaySlot() {
        if (this.displaySlots.length < 2) {
            return null;
        }

        return this.displaySlots[(this.activeDisplaySlotIndex + 1) % this.displaySlots.length] ?? null;
    }

    setDisplaySlotTransition(slot, enabled) {
        if (!slot?.layer?.style) {
            return;
        }

        slot.layer.style.transition = enabled
            ? `transform ${DISPLAY_SLIDE_TRANSITION_MS}ms cubic-bezier(0.22, 1, 0.36, 1)`
            : "none";
    }

    setDisplaySlotOffset(slot, offsetPx) {
        if (!slot?.layer?.style) {
            return;
        }

        slot.layer.style.transform = `translate3d(${Number(offsetPx || 0).toFixed(3)}px, 0, 0)`;
    }

    resetDisplayLayerPositions() {
        const activeSlot = this.getActiveDisplaySlot();
        const inactiveSlot = this.getInactiveDisplaySlot();
        const stageWidth = this.getDisplayStageWidth();

        if (activeSlot) {
            this.setDisplaySlotTransition(activeSlot, false);
            this.setDisplaySlotOffset(activeSlot, 0);
        }

        if (inactiveSlot) {
            this.setDisplaySlotTransition(inactiveSlot, false);
            this.setDisplaySlotOffset(inactiveSlot, stageWidth);
        }
    }

    renderBankIntoSlot(slot, bank) {
        if (!slot || !bank) {
            return;
        }

        slot.display.setFrames(bank.frames);
        slot.display.setPosition(this.currentDisplayPosition);
        slot.tableIndex = bank.tableIndex;
        slot.frameCount = bank.frameCount;
    }

    finalizeDisplayedBank(bank) {
        this.currentFrameCount = Math.max(1, Number(bank?.frameCount) || 1);
        this.display = this.getActiveDisplaySlot()?.display ?? this.display;
        this.updateFrameReadouts();
        this.updateBankReadout();
        this.setDisplayState(
            "loaded",
            this.options.platform === "ios"
                ? `${bank.frameCount} shapes`
                : `${bank.frameCount} frames`
        );
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
        const frameIndex = Math.round(this.currentDisplayPosition * Math.max(0, safeFrameCount - 1)) + 1;

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

    async fetchDisplayBank(tableIndex, { showLoadingState = false } = {}) {
        const cachedBank = this.displayFramesCache.get(tableIndex);
        if (cachedBank) {
            return cachedBank;
        }

        const inFlightRequest = this.displayFramesLoading.get(tableIndex);
        if (inFlightRequest) {
            return inFlightRequest;
        }

        if (showLoadingState) {
            this.setDisplayState("loading", "Loading wavetable bank…");
        }

        const request = loadFactoryBankFramesFromPatch(this.patchConnection, { tableIndex })
            .then((bank) => {
                this.displayFramesCache.set(tableIndex, bank);
                return bank;
            })
            .catch((error) => {
                console.error(error);

                if (showLoadingState) {
                    const detail = String(error?.message || error || "Unknown error");
                    this.setDisplayState("error", `Could not load wavetable bank: ${detail}`);
                    if (this.bankReadout) {
                        this.bankReadout.textContent = this.options.platform === "ios"
                            ? "Display unavailable"
                            : `Display unavailable: ${detail}`;
                    }
                }

                throw error;
            })
            .finally(() => {
                this.displayFramesLoading.delete(tableIndex);
            });

        this.displayFramesLoading.set(tableIndex, request);
        return request;
    }

    preloadAdjacentTables(tableIndex = this.currentTableIndex) {
        const tableCount = this.factoryBankCatalog?.tables?.length ?? 0;

        getAdjacentTableIndices(tableIndex, tableCount).forEach((adjacentTableIndex) => {
            void this.fetchDisplayBank(adjacentTableIndex).catch(() => {});
        });
    }

    applyLoadedBank(bank) {
        const activeSlot = this.getActiveDisplaySlot();
        this.renderBankIntoSlot(activeSlot, bank);
        this.resetDisplayLayerPositions();
        this.finalizeDisplayedBank(bank);
    }

    async animateTableSlide(bank, direction) {
        const activeSlot = this.getActiveDisplaySlot();
        const inactiveSlot = this.getInactiveDisplaySlot();

        if (!activeSlot || !inactiveSlot || direction === 0) {
            this.applyLoadedBank(bank);
            return;
        }

        const stageWidth = this.getDisplayStageWidth();
        const incomingOffset = direction > 0 ? stageWidth : -stageWidth;
        const outgoingOffset = direction > 0 ? -stageWidth : stageWidth;

        this.renderBankIntoSlot(inactiveSlot, bank);
        this.setDisplaySlotTransition(activeSlot, false);
        this.setDisplaySlotTransition(inactiveSlot, false);
        this.setDisplaySlotOffset(activeSlot, 0);
        this.setDisplaySlotOffset(inactiveSlot, incomingOffset);

        await new Promise((resolve) => requestAnimationFrame(resolve));

        this.setDisplaySlotTransition(activeSlot, true);
        this.setDisplaySlotTransition(inactiveSlot, true);
        this.setDisplaySlotOffset(activeSlot, outgoingOffset);
        this.setDisplaySlotOffset(inactiveSlot, 0);

        await new Promise((resolve) => window.setTimeout(resolve, DISPLAY_SLIDE_TRANSITION_MS));

        this.activeDisplaySlotIndex = inactiveSlot.slotIndex;
        this.display = inactiveSlot.display;
        this.finalizeDisplayedBank(bank);
        this.resetDisplayLayerPositions();
    }

    async setSelectedTableIndex(value, { animateDirection = 0 } = {}) {
        const maxTableIndex = this.factoryBankCatalog
            ? Math.max(0, this.factoryBankCatalog.tables.length - 1)
            : 255;
        const nextTableIndex = clamp(Math.round(Number(value) || 0), 0, maxTableIndex);
        const requestToken = this.nextDisplaySelectionToken;
        this.nextDisplaySelectionToken += 1;
        const previousTableIndex = this.currentTableIndex;

        if (this.tableSelect && this.tableSelect.value !== String(nextTableIndex)) {
            this.tableSelect.value = String(nextTableIndex);
        }

        if (
            nextTableIndex === this.currentTableIndex &&
            this.displayFramesCache.has(nextTableIndex) &&
            this.getActiveDisplaySlot()?.tableIndex === nextTableIndex
        ) {
            return;
        }

        this.currentTableIndex = nextTableIndex;
        this.updateBankReadout();

        const bank = await this.fetchDisplayBank(nextTableIndex, { showLoadingState: true });
        if (requestToken !== this.nextDisplaySelectionToken - 1) {
            return;
        }

        if (animateDirection !== 0 && nextTableIndex !== previousTableIndex) {
            await this.animateTableSlide(bank, animateDirection);
        } else {
            this.applyLoadedBank(bank);
        }

        if (nextTableIndex === this.currentTableIndex) {
            this.preloadAdjacentTables(nextTableIndex);
        }
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
            .finally(() => {
                void this.setSelectedTableIndex(this.currentTableIndex).catch(() => {});
            });
    }

    handleMsegStateChange(state) {
        this.msegState = state;
        this.selectedMsegPointIndex = clamp(
            this.selectedMsegPointIndex,
            0,
            Math.max(0, state.shape.points.length - 1)
        );
        this.renderMsegEditor();
        this.syncMsegDepthControl();
    }

    syncMsegDepthControl() {
        if (!this.msegDepthInput || !this.msegState) {
            return;
        }

        const nextDepth = clampDepth(this.msegState.depth);
        if (document.activeElement !== this.msegDepthInput) {
            this.msegDepthInput.value = nextDepth.toFixed(3);
        }

        if (this.msegDepthReadout) {
            this.msegDepthReadout.textContent = nextDepth.toFixed(3);
        }
    }

    renderMsegEditor() {
        if (!this.msegViewport || !this.msegCurve || !this.msegPointsLayer || !this.msegState) {
            return;
        }

        const width = Math.max(1, this.msegViewport.viewBox.baseVal.width || this.msegViewport.clientWidth || 600);
        const height = Math.max(1, this.msegViewport.viewBox.baseVal.height || this.msegViewport.clientHeight || 180);
        const samples = 96;
        let pathData = "";

        for (let index = 0; index < samples; index += 1) {
            const x = index / (samples - 1);
            const y = evaluateMsegShape(this.msegState.shape, x);
            const screenX = x * width;
            const screenY = (1.0 - y) * height;
            pathData += `${index === 0 ? "M" : "L"} ${screenX.toFixed(3)} ${screenY.toFixed(3)} `;
        }

        this.msegCurve.setAttribute("d", pathData.trim());
        this.msegPointsLayer.innerHTML = "";

        this.msegState.shape.points.forEach((point, pointIndex) => {
            const coordinates = pointToEditorCoordinates(point, width, height);
            const circle = document.createElementNS(SVG_NS, "circle");
            circle.setAttribute("cx", coordinates.x.toFixed(3));
            circle.setAttribute("cy", coordinates.y.toFixed(3));
            circle.setAttribute("r", pointIndex === this.selectedMsegPointIndex ? "6" : "5");
            circle.setAttribute("class", pointIndex === this.selectedMsegPointIndex ? "mseg-point selected" : "mseg-point");
            circle.dataset.pointIndex = String(pointIndex);
            this.msegPointsLayer.appendChild(circle);
        });

        if (this.msegDeleteButton) {
            const isEndpoint =
                this.selectedMsegPointIndex === 0 ||
                this.selectedMsegPointIndex === this.msegState.shape.points.length - 1;
            this.msegDeleteButton.disabled = isEndpoint;
        }
    }

    beginMsegInteraction(event) {
        if (!this.msegViewport || !this.msegState) {
            return;
        }

        const bounds = this.msegViewport.getBoundingClientRect();
        const targetPointIndex = findMsegPointHitIndex(
            this.msegState.shape,
            event.clientX - bounds.left,
            event.clientY - bounds.top,
            bounds.width,
            bounds.height
        );

        if (targetPointIndex >= 0) {
            this.selectedMsegPointIndex = targetPointIndex;
            this.activeMsegDrag = {
                pointerId: event.pointerId,
                pointIndex: this.selectedMsegPointIndex,
            };
            this.renderMsegEditor();
            this.msegViewport.setPointerCapture?.(event.pointerId);
            event.preventDefault?.();
            return;
        }

        const point = editorCoordinatesToPoint(event.clientX, event.clientY, bounds);
        this.msegController?.addPoint(point.x, point.y);
        const points = this.msegController?.getState().shape.points ?? [];
        this.selectedMsegPointIndex = points.findIndex(
            (nextPoint) =>
                Math.abs(nextPoint.x - point.x) <= 1e-6 &&
                Math.abs(nextPoint.y - point.y) <= 1e-6
        );
        this.renderMsegEditor();
        event.preventDefault?.();
    }

    updateMsegInteraction(event) {
        if (!this.activeMsegDrag || !this.msegViewport) {
            return;
        }

        if (event.pointerId !== this.activeMsegDrag.pointerId) {
            return;
        }

        const bounds = this.msegViewport.getBoundingClientRect();
        const point = editorCoordinatesToPoint(event.clientX, event.clientY, bounds);
        this.msegController?.movePoint(this.activeMsegDrag.pointIndex, point.x, point.y);
        this.selectedMsegPointIndex = this.activeMsegDrag.pointIndex;
        event.preventDefault?.();
    }

    endMsegInteraction(event) {
        if (!this.activeMsegDrag || event.pointerId !== this.activeMsegDrag.pointerId) {
            return;
        }

        this.msegViewport?.releasePointerCapture?.(event.pointerId);
        this.activeMsegDrag = null;
        event.preventDefault?.();
    }

    deleteSelectedMsegPoint() {
        if (!this.msegController || !this.msegState) {
            return;
        }

        const isEndpoint =
            this.selectedMsegPointIndex === 0 ||
            this.selectedMsegPointIndex === this.msegState.shape.points.length - 1;

        if (isEndpoint) {
            return;
        }

        this.msegController.deletePoint(this.selectedMsegPointIndex);
        this.selectedMsegPointIndex = clamp(
            this.selectedMsegPointIndex - 1,
            0,
            this.msegController.getState().shape.points.length - 1
        );
        this.renderMsegEditor();
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

    getKeyboardRangeLabel() {
        const startNote = this.keyboardRootNote;
        const lastNote = this.keyboardRootNote + Math.max(0, this.currentLayout.noteCount - 1);
        const formatNote = (noteNumber) => {
            const safeNote = Math.max(0, Math.round(Number(noteNumber) || 0));
            return `${NOTE_NAMES[safeNote % 12]}${Math.floor(safeNote / 12) - 1}`;
        };

        return `${formatNote(startNote)} - ${formatNote(lastNote)}`;
    }

    syncKeyboardOctaveControls() {
        if (this.octaveReadout) {
            this.octaveReadout.textContent = this.getKeyboardRangeLabel();
        }

        if (this.octaveDownButton) {
            this.octaveDownButton.disabled = this.keyboardRootNote <= this.keyboardMinRootNote;
        }

        if (this.octaveUpButton) {
            this.octaveUpButton.disabled = this.keyboardRootNote >= this.keyboardMaxRootNote;
        }
    }

    setKeyboardRootNote(value) {
        const nextRootNote = clamp(
            Math.round(Number(value) || 0),
            this.keyboardMinRootNote,
            this.keyboardMaxRootNote
        );

        this.keyboardRootNote = nextRootNote;
        this.keyboard?.setAttribute("root-note", String(nextRootNote));
        this.syncKeyboardOctaveControls();
    }

    nudgeKeyboardOctave(offset) {
        this.setKeyboardRootNote(this.keyboardRootNote + offset);
        this.focusKeyboard();
    }

    syncKeyboardGeometry() {
        if (this.options.platform !== "ios" || !this.keyboard || !this.keyboardHost) {
            return;
        }

        const hostWidth = this.keyboardHost.getBoundingClientRect().width;
        if (hostWidth <= 0) {
            return;
        }

        const { naturalWidth, accidentalWidth } = computeKeyboardDimensions({
            rootNote: this.keyboardRootNote,
            noteCount: this.currentLayout.noteCount,
            availableWidth: hostWidth,
            minNaturalWidth: this.currentLayout.keyboardNaturalNoteWidth,
        });

        const currentNaturalWidth = Number(this.keyboard.naturalWidth) || 0;
        const currentAccidentalWidth = Number(this.keyboard.accidentalWidth) || 0;

        if (
            Math.abs(currentNaturalWidth - naturalWidth) < 0.01 &&
            Math.abs(currentAccidentalWidth - accidentalWidth) < 0.01
        ) {
            return;
        }

        this.keyboard.naturalWidth = naturalWidth;
        this.keyboard.accidentalWidth = accidentalWidth;
        this.keyboard.notes = [];
        this.keyboard.refreshHTML();
        this.keyboard.bindRenderedTouchHandlers?.();
        this.keyboard.refreshActiveNoteElements?.();
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
        this.keyboard.setAttribute("root-note", String(this.keyboardRootNote));
        this.keyboard.setAttribute("note-count", `${this.currentLayout.noteCount}`);
        this.keyboard.attachToPatchConnection?.(this.patchConnection, midiInputEndpointID);
        this.keyboard.addEventListener("mousedown", () => this.focusKeyboard(), { passive: true });

        this.keyboardHost.innerHTML = "";
        this.keyboardHost.appendChild(this.keyboard);

        this.syncKeyboardGeometry();
        requestAnimationFrame(() => {
            this.syncKeyboardGeometry();
            this.focusKeyboard();
        });
        this.keyboardStyle = keyboardStyle;
        this.keyboardNoteCount = this.currentLayout.noteCount;
        this.hasOnscreenKeyboard = true;
        this.syncKeyboardOctaveControls();
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
        const endpointID = endpointInfo.endpointID || wavetablePositionEndpointID;

        if (this.scanRailEndpointID === endpointID) {
            return;
        }

        this.scanRailEndpointID = endpointID;

        if (!this.scanRailInput) {
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
        return this.scanRailEndpointID || this.knobEndpointID || wavetablePositionEndpointID;
    }

    sendSelectedTableIndex(nextIndex) {
        this.patchConnection.sendParameterGestureStart?.(wavetableSelectEndpointID);
        this.patchConnection.sendEventOrValue(wavetableSelectEndpointID, nextIndex);
        this.patchConnection.sendParameterGestureEnd?.(wavetableSelectEndpointID);
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

        if (event.target?.closest?.(".bank-picker-trigger")) {
            return;
        }

        const bounds = this.displayViewport.getBoundingClientRect();
        this.activeDisplayDrag = {
            pointerId: event.pointerId,
            startClientX: event.clientX,
            startClientY: event.clientY,
            endpointID,
            mode: "pending",
            startTableIndex: this.currentTableIndex,
            startValue: this.currentValue,
            dragSpanX: bounds.width,
            dragSpanY: bounds.height,
        };

        this.displayViewport.setPointerCapture?.(event.pointerId);
        this.preloadAdjacentTables(this.currentTableIndex);
        event.preventDefault?.();
    }

    updateDisplayDrag(event) {
        if (!this.activeDisplayDrag || event.pointerId !== this.activeDisplayDrag.pointerId) {
            return;
        }

        const deltaX = event.clientX - this.activeDisplayDrag.startClientX;
        const deltaY = event.clientY - this.activeDisplayDrag.startClientY;
        const gestureAxis = resolveDisplayGestureAxis(deltaX, deltaY);

        if (this.activeDisplayDrag.mode === "pending" && gestureAxis !== "pending") {
            this.activeDisplayDrag.mode = gestureAxis;

            if (gestureAxis === "vertical") {
                this.patchConnection.sendParameterGestureStart?.(this.activeDisplayDrag.endpointID);
            }
        }

        if (this.activeDisplayDrag.mode === "horizontal") {
            const tableCount = this.factoryBankCatalog?.tables?.length ?? 0;
            const swipeTarget = resolveHorizontalSwipeTarget(
                this.activeDisplayDrag.startTableIndex,
                deltaX,
                tableCount
            );
            const activeSlot = this.getActiveDisplaySlot();
            const inactiveSlot = this.getInactiveDisplaySlot();
            const stageWidth = this.getDisplayStageWidth();
            const clampedOffset = clamp(deltaX, -stageWidth, stageWidth);

            this.activeDisplayDrag.currentDeltaX = clampedOffset;
            this.activeDisplayDrag.direction = swipeTarget.direction;
            this.activeDisplayDrag.previewTargetTableIndex = swipeTarget.targetTableIndex;
            this.activeDisplayDrag.hasHorizontalTarget = swipeTarget.hasTarget;

            if (activeSlot) {
                this.setDisplaySlotTransition(activeSlot, false);
                this.setDisplaySlotOffset(activeSlot, clampedOffset);
            }

            if (inactiveSlot) {
                if (swipeTarget.hasTarget) {
                    const previewBank = this.displayFramesCache.get(swipeTarget.targetTableIndex);
                    if (previewBank) {
                        this.renderBankIntoSlot(inactiveSlot, previewBank);
                        this.setDisplaySlotTransition(inactiveSlot, false);
                        this.setDisplaySlotOffset(
                            inactiveSlot,
                            clampedOffset + (swipeTarget.direction > 0 ? stageWidth : -stageWidth)
                        );
                    } else {
                        void this.fetchDisplayBank(swipeTarget.targetTableIndex).catch(() => {});
                        this.setDisplaySlotTransition(inactiveSlot, false);
                        this.setDisplaySlotOffset(inactiveSlot, swipeTarget.direction > 0 ? stageWidth : -stageWidth);
                    }
                } else {
                    this.setDisplaySlotTransition(inactiveSlot, false);
                    this.setDisplaySlotOffset(inactiveSlot, stageWidth);
                }
            }

            event.preventDefault?.();
            return;
        }

        if (this.activeDisplayDrag.mode !== "vertical") {
            return;
        }

        const nextValue = mapDisplayDragToPosition(
            this.activeDisplayDrag.startValue,
            this.activeDisplayDrag.startClientY,
            event.clientY,
            this.activeDisplayDrag.dragSpanY
        );

        this.commitDraggedDisplayPosition(nextValue);
        event.preventDefault?.();
    }

    endDisplayDrag(event) {
        if (!this.activeDisplayDrag || event.pointerId !== this.activeDisplayDrag.pointerId) {
            return;
        }

        this.displayViewport?.releasePointerCapture?.(event.pointerId);
        const dragState = this.activeDisplayDrag;
        this.activeDisplayDrag = null;

        if (dragState.mode === "vertical") {
            this.patchConnection.sendParameterGestureEnd?.(dragState.endpointID);
        } else if (dragState.mode === "horizontal") {
            const swipeTarget = resolveHorizontalSwipeTarget(
                dragState.startTableIndex,
                dragState.currentDeltaX,
                this.factoryBankCatalog?.tables?.length ?? 0
            );
            const shouldCommitSwipe =
                swipeTarget.hasTarget &&
                shouldCommitHorizontalSwipe(dragState.currentDeltaX, dragState.dragSpanX);

            this.resetDisplayLayerPositions();

            if (shouldCommitSwipe) {
                this.sendSelectedTableIndex(swipeTarget.targetTableIndex);
                void this.setSelectedTableIndex(swipeTarget.targetTableIndex, {
                    animateDirection: swipeTarget.direction,
                });
            }
        } else {
            this.resetDisplayLayerPositions();
        }

        event.preventDefault?.();
    }

    handleObservedDisplayPosition(message) {
        const nextState = selectObservedWavetablePositionState(
            this.observedWavetablePositionState,
            message
        );

        if (
            nextState.voiceGeneration === this.observedWavetablePositionState.voiceGeneration &&
            displayPositionsMatch(nextState.position, this.observedWavetablePositionState.position)
        ) {
            return;
        }

        this.observedWavetablePositionState = nextState;
        this.setDisplayPosition(nextState.position);
    }

    setDisplayPosition(value) {
        const nextValue = clampDisplayPosition(value);

        if (displayPositionsMatch(this.currentDisplayPosition, nextValue)) {
            return;
        }

        this.currentDisplayPosition = nextValue;
        this.updateFrameReadouts();
        this.displaySlots.forEach((slot) => slot.display.setPosition(nextValue));
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

        if (this.scanRailInput && document.activeElement !== this.scanRailInput) {
            this.scanRailInput.value = nextValue.toFixed(3);
        }

        this.setDisplayPosition(nextValue);
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

                .mseg-panel {
                    border-radius: 16px;
                    border: 1px solid rgba(122, 142, 255, 0.12);
                    background: rgba(5, 8, 20, 0.88);
                    padding: 14px;
                    display: grid;
                    gap: 12px;
                }

                .mseg-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: end;
                    gap: 12px;
                }

                .mseg-title {
                    display: grid;
                    gap: 4px;
                }

                .mseg-title strong {
                    font-size: 16px;
                    letter-spacing: -0.03em;
                    color: #eef2f5;
                }

                .mseg-depth-readout {
                    font-family: "SF Mono", "IBM Plex Mono", Menlo, monospace;
                    font-size: 12px;
                    letter-spacing: 0.08em;
                    color: #87d7f5;
                }

                .mseg-editor-shell {
                    position: relative;
                    border-radius: 12px;
                    overflow: hidden;
                    border: 1px solid rgba(122, 142, 255, 0.14);
                    background:
                        linear-gradient(180deg, rgba(255, 255, 255, 0.018), transparent 22%),
                        linear-gradient(180deg, rgba(8, 12, 24, 0.94), rgba(4, 7, 15, 0.98));
                }

                .mseg-editor {
                    display: block;
                    width: 100%;
                    height: 180px;
                    touch-action: none;
                    cursor: crosshair;
                }

                .mseg-grid {
                    stroke: rgba(255, 255, 255, 0.08);
                    stroke-width: 1;
                }

                .mseg-curve {
                    fill: none;
                    stroke: #87d7f5;
                    stroke-width: 3;
                    stroke-linejoin: round;
                    stroke-linecap: round;
                }

                .mseg-point {
                    fill: #ffd8a6;
                    stroke: rgba(4, 7, 15, 0.96);
                    stroke-width: 2;
                    cursor: grab;
                }

                .mseg-point.selected {
                    fill: #f56cb6;
                }

                .mseg-controls {
                    display: grid;
                    grid-template-columns: minmax(0, 1fr) auto;
                    gap: 12px;
                    align-items: center;
                }

                .mseg-depth {
                    display: grid;
                    gap: 6px;
                }

                .mseg-depth-label {
                    font-size: 10px;
                    letter-spacing: 0.1em;
                    text-transform: uppercase;
                    color: rgba(194, 202, 255, 0.72);
                }

                .mseg-depth-slider {
                    width: 100%;
                }

                .mseg-delete-point {
                    border: 1px solid rgba(245, 108, 182, 0.28);
                    border-radius: 10px;
                    background: rgba(245, 108, 182, 0.08);
                    color: #ffd8e8;
                    padding: 10px 12px;
                    font-size: 12px;
                    letter-spacing: 0.08em;
                    text-transform: uppercase;
                }

                .mseg-delete-point:disabled {
                    opacity: 0.45;
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

                    <div class="mseg-panel">
                        <div class="mseg-header">
                            <div class="mseg-title">
                                <div class="title">MSEG 1</div>
                                <strong>Fixed Wavetable Route</strong>
                            </div>
                            <div class="mseg-depth-readout" data-role="mseg-depth-readout">1.000</div>
                        </div>

                        <div class="mseg-editor-shell">
                            <svg class="mseg-editor" viewBox="0 0 600 180" preserveAspectRatio="none">
                                <g class="mseg-grid">
                                    <line x1="0" y1="45" x2="600" y2="45"></line>
                                    <line x1="0" y1="90" x2="600" y2="90"></line>
                                    <line x1="0" y1="135" x2="600" y2="135"></line>
                                    <line x1="150" y1="0" x2="150" y2="180"></line>
                                    <line x1="300" y1="0" x2="300" y2="180"></line>
                                    <line x1="450" y1="0" x2="450" y2="180"></line>
                                </g>
                                <path class="mseg-curve"></path>
                                <g class="mseg-points"></g>
                            </svg>
                        </div>

                        <div class="mseg-controls">
                            <label class="mseg-depth">
                                <span class="mseg-depth-label">Depth To Wavetable Position</span>
                                <input class="mseg-depth-slider" type="range" min="-1" max="1" step="0.001" value="1.000" />
                            </label>
                            <button class="mseg-delete-point" type="button">Delete Point</button>
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
                    height: 100%;
                    min-height: 100dvh;
                    overflow-x: hidden;
                    overscroll-behavior: none;
                    background: #04070f;
                    color: #eef2f5;
                    font-family: "SF Pro Display", "SF Pro Text", -apple-system, BlinkMacSystemFont, "Avenir Next", sans-serif;
                    --cosimo-section-gap: 12px;
                    --cosimo-stage-min-height: 248px;
                    --cosimo-keyboard-height: 122px;
                    --cosimo-control-height: 54px;
                }

                .ios-shell {
                    width: 100%;
                    height: 100%;
                    min-height: 100dvh;
                    min-width: 0;
                    display: grid;
                    grid-template-rows: minmax(0, 1fr) auto;
                }

                .ios-scroll {
                    min-height: 0;
                    overflow-y: auto;
                    overscroll-behavior: contain;
                    -webkit-overflow-scrolling: touch;
                }

                .ios-content {
                    display: grid;
                    min-width: 0;
                    align-content: start;
                    gap: 16px;
                    padding:
                        max(12px, env(safe-area-inset-top))
                        max(16px, env(safe-area-inset-right))
                        18px
                        max(16px, env(safe-area-inset-left));
                }

                .wavetable-panel,
                .mseg-panel,
                .keyboard-footer {
                    min-width: 0;
                }

                .section-label,
                .display-status,
                .bank-readout,
                .mini-label,
                .octave-readout {
                    font-family: "SF Mono", "IBM Plex Mono", Menlo, monospace;
                    letter-spacing: 0.16em;
                    text-transform: uppercase;
                }

                .section-label,
                .mini-label {
                    font-size: 10px;
                    color: rgba(212, 220, 230, 0.34);
                }

                .wavetable-panel {
                    display: grid;
                    min-width: 0;
                    gap: 0;
                }

                .display-status,
                .bank-readout,
                .position-label {
                    font-size: 10px;
                    color: rgba(212, 220, 230, 0.42);
                }

                .table-picker {
                    display: grid;
                    gap: 6px;
                }

                .bank-picker-trigger {
                    position: relative;
                    display: inline-flex;
                    align-items: end;
                    min-width: 0;
                    max-width: min(72%, 260px);
                    pointer-events: auto;
                }

                .table-select-overlay {
                    position: absolute;
                    inset: -8px -10px;
                    width: calc(100% + 20px);
                    min-height: 40px;
                    opacity: 0.001;
                    appearance: none;
                    border: 0;
                    background: transparent;
                    color: transparent;
                    font-size: 16px;
                }

                .shape-readout,
                .position-readout {
                    font-family: "SF Pro Display", "SF Pro Text", -apple-system, BlinkMacSystemFont, sans-serif;
                    font-weight: 600;
                    letter-spacing: -0.03em;
                    color: #87d7f5;
                }

                .shape-readout {
                    font-size: 12px;
                }

                .position-readout {
                    font-size: 20px;
                    line-height: 1;
                }

                .wavetable-stage {
                    position: relative;
                    width: 100%;
                    min-width: 0;
                    max-width: 100%;
                    min-height: var(--cosimo-stage-min-height);
                    aspect-ratio: 1.55 / 1;
                    border-radius: 0;
                    overflow: hidden;
                    background: transparent;
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

                .wavetable-display-stack {
                    position: absolute;
                    inset: 0;
                }

                .wavetable-layer {
                    position: absolute;
                    inset: 0;
                    will-change: transform;
                }

                .wavetable-canvas {
                    position: absolute;
                    inset: 0;
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

                .bank-readout {
                    min-width: 0;
                    overflow: hidden;
                    white-space: nowrap;
                    text-overflow: ellipsis;
                }

                .display-status {
                    justify-self: start;
                    padding: 6px 10px;
                    border-radius: 999px;
                    background: rgba(255, 255, 255, 0.04);
                }

                .keyboard-footer {
                    display: grid;
                    gap: 10px;
                    padding:
                        10px
                        max(16px, env(safe-area-inset-right))
                        max(10px, env(safe-area-inset-bottom))
                        max(16px, env(safe-area-inset-left));
                    border-top: 0;
                    background: transparent;
                    box-shadow: none;
                }

                .keyboard-toolbar {
                    display: flex;
                    justify-content: center;
                    align-items: center;
                }

                .octave-controls {
                    display: inline-grid;
                    grid-template-columns: auto auto auto;
                    gap: 8px;
                    align-items: center;
                }

                .octave-button {
                    min-width: 72px;
                    min-height: 34px;
                    border: 1px solid rgba(255, 255, 255, 0.1);
                    border-radius: 999px;
                    background: rgba(255, 255, 255, 0.04);
                    color: #eef2f5;
                    font-size: 12px;
                    letter-spacing: 0.08em;
                    text-transform: uppercase;
                }

                .octave-button:disabled {
                    opacity: 0.32;
                }

                .octave-readout {
                    min-width: 88px;
                    text-align: center;
                    font-size: 12px;
                    color: #87d7f5;
                }

                .keyboard-host {
                    min-width: 0;
                    min-height: var(--cosimo-keyboard-height);
                    display: grid;
                    align-items: stretch;
                }

                .keyboard {
                    width: 100%;
                    height: var(--cosimo-keyboard-height);
                    border-radius: 14px 14px 18px 18px;
                    overflow: hidden;
                    background:
                        linear-gradient(180deg, rgba(255, 255, 255, 0.025), transparent 18%),
                        linear-gradient(180deg, rgba(10, 13, 18, 0.68), rgba(7, 9, 13, 0.92));
                    padding: 6px 6px 8px;
                    touch-action: none;
                }

                .mseg-panel {
                    display: grid;
                    min-width: 0;
                    gap: 10px;
                }

                .mseg-head {
                    display: grid;
                    min-width: 0;
                    grid-template-columns: minmax(0, 1fr) auto;
                    gap: 8px;
                    align-items: end;
                }

                .mseg-title {
                    display: grid;
                    gap: 4px;
                }

                .mseg-title strong {
                    font-size: 15px;
                    font-weight: 600;
                    color: #eef2f5;
                    letter-spacing: -0.03em;
                }

                .mseg-depth-readout {
                    font-family: "SF Mono", "IBM Plex Mono", Menlo, monospace;
                    font-size: 12px;
                    color: #87d7f5;
                    letter-spacing: 0.08em;
                }

                .mseg-editor-shell {
                    border-radius: 0;
                    overflow: hidden;
                    border: 0;
                    background: transparent;
                }

                .mseg-editor {
                    display: block;
                    width: 100%;
                    height: 148px;
                    touch-action: none;
                }

                .mseg-grid {
                    stroke: rgba(255, 255, 255, 0.08);
                    stroke-width: 1;
                }

                .mseg-curve {
                    fill: none;
                    stroke: #87d7f5;
                    stroke-width: 3;
                    stroke-linejoin: round;
                    stroke-linecap: round;
                }

                .mseg-point {
                    fill: #ffd8a6;
                    stroke: rgba(4, 7, 15, 0.96);
                    stroke-width: 2;
                }

                .mseg-point.selected {
                    fill: #f56cb6;
                }

                .mseg-controls {
                    display: grid;
                    min-width: 0;
                    grid-template-columns: minmax(0, 1fr) auto;
                    gap: 10px;
                    align-items: center;
                }

                @media (max-height: 720px) {
                    .ios-content {
                        gap: 14px;
                    }

                    .mseg-editor {
                        height: 136px;
                    }
                }

                .mseg-depth {
                    display: grid;
                    gap: 6px;
                }

                .mseg-depth-label {
                    font-size: 10px;
                    color: rgba(212, 220, 230, 0.42);
                    letter-spacing: 0.12em;
                    text-transform: uppercase;
                }

                .mseg-delete-point {
                    border: 1px solid rgba(245, 108, 182, 0.28);
                    border-radius: 10px;
                    background: rgba(245, 108, 182, 0.08);
                    color: #ffd8e8;
                    padding: 10px 12px;
                    font-size: 12px;
                    letter-spacing: 0.08em;
                    text-transform: uppercase;
                }

                .mseg-delete-point:disabled {
                    opacity: 0.45;
                }
            </style>

            <div class="ios-shell">
                <div class="ios-scroll">
                    <div class="ios-content">
                        <div class="wavetable-panel">
                            <div class="wavetable-stage" data-state="loading">
                                <div class="wavetable-display-stack">
                                    <div class="wavetable-layer">
                                        <canvas class="wavetable-canvas"></canvas>
                                    </div>
                                    <div class="wavetable-layer">
                                        <canvas class="wavetable-canvas"></canvas>
                                    </div>
                                </div>
                                <div class="display-overlay">Loading wavetable bank…</div>
                                <div class="stage-copy">
                                    <div class="stage-copy-row">
                                        <div class="mini-label active">Wavescan</div>
                                        <div class="shape-readout" data-role="hero-frame-readout">01/16</div>
                                    </div>
                                    <div></div>
                                    <div class="stage-copy-row">
                                        <label class="bank-picker-trigger">
                                            <div class="bank-readout">Factory bank</div>
                                            <select class="table-select table-select-overlay" aria-label="Select wavetable"></select>
                                        </label>
                                        <div class="mini-label warm" data-role="stage-gesture-hint">Swipe + Drag</div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div class="mseg-panel">
                            <div class="mseg-head">
                                <div class="mseg-title">
                                    <div class="section-label">MSEG 1</div>
                                    <strong>Fixed Wavetable Route</strong>
                                </div>

                                <div class="mseg-depth-readout" data-role="mseg-depth-readout">1.000</div>
                            </div>

                            <div class="mseg-editor-shell">
                                <svg class="mseg-editor" viewBox="0 0 600 156" preserveAspectRatio="none">
                                    <g class="mseg-grid">
                                        <line x1="0" y1="39" x2="600" y2="39"></line>
                                        <line x1="0" y1="78" x2="600" y2="78"></line>
                                        <line x1="0" y1="117" x2="600" y2="117"></line>
                                        <line x1="150" y1="0" x2="150" y2="156"></line>
                                        <line x1="300" y1="0" x2="300" y2="156"></line>
                                        <line x1="450" y1="0" x2="450" y2="156"></line>
                                    </g>
                                    <path class="mseg-curve"></path>
                                    <g class="mseg-points"></g>
                                </svg>
                            </div>

                            <div class="mseg-controls">
                                <label class="mseg-depth">
                                    <span class="mseg-depth-label">Depth To Wavetable Position</span>
                                    <input class="mseg-depth-slider" type="range" min="-1" max="1" step="0.001" value="1.000" />
                                </label>
                                <button class="mseg-delete-point" type="button">Delete Point</button>
                            </div>
                        </div>
                    </div>
                </div>

                <div class="keyboard-footer">
                    <div class="keyboard-toolbar">
                        <div class="octave-controls">
                            <button class="octave-button octave-down" type="button">Oct -</button>
                            <div class="octave-readout" data-role="octave-readout">C3 - C5</div>
                            <button class="octave-button octave-up" type="button">Oct +</button>
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
