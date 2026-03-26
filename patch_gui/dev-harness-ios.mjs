import createIOSPatchView from "./index.ios.js";

const midiInputEndpointID = "midiIn";
const wavetablePositionEndpointID = "wavetablePosition";

class MockPianoKeyboard extends HTMLElement {
    constructor() {
        super();
        this.attachShadow({ mode: "open" });
        this.shadowRoot.innerHTML = `
            <style>
                :host {
                    display: block;
                    width: 100%;
                    height: 100%;
                }

                .note-holder {
                    width: 100%;
                    height: 100%;
                    border-radius: 12px;
                    background:
                        repeating-linear-gradient(
                            90deg,
                            rgba(244, 247, 251, 0.96) 0,
                            rgba(244, 247, 251, 0.96) 22px,
                            rgba(214, 221, 231, 0.96) 22px,
                            rgba(214, 221, 231, 0.96) 24px
                        );
                }
            </style>
            <div class="note-holder" tabindex="0" title="Harness keyboard placeholder"></div>
        `;
    }

    handleExternalMIDI() {}

    attachToPatchConnection() {}

    detachPatchConnection() {}
}

class MockPatchConnection {
    constructor(manifest) {
        this.manifest = manifest;
        this.parameterValues = new Map([[wavetablePositionEndpointID, 0.58]]);
        this.parameterListeners = new Map();
        this.endpointListeners = new Map();
        this.statusListeners = new Set();
        this.status = {
            manifest,
            details: {
                inputs: [
                    {
                        endpointID: midiInputEndpointID,
                        purpose: "event",
                    },
                    {
                        endpointID: wavetablePositionEndpointID,
                        purpose: "parameter",
                        annotation: {
                            name: "Wavetable Position",
                            min: 0.0,
                            max: 1.0,
                            init: 0.58,
                        },
                    },
                ],
            },
        };
        this.utilities = {
            PianoKeyboard: MockPianoKeyboard,
            ParameterControls: {
                Knob: class extends HTMLElement {
                    static getCSS() {
                        return "";
                    }
                },
            },
        };
    }

    getResourceAddress(path) {
        const relativePath = path.startsWith("/") ? path.slice(1) : path;
        return `../${relativePath}`;
    }

    addParameterListener(endpointID, listener) {
        const listeners = this.parameterListeners.get(endpointID) ?? new Set();
        listeners.add(listener);
        this.parameterListeners.set(endpointID, listeners);
    }

    removeParameterListener(endpointID, listener) {
        this.parameterListeners.get(endpointID)?.delete(listener);
    }

    requestParameterValue(endpointID) {
        queueMicrotask(() => {
            const value = this.parameterValues.get(endpointID) ?? 0;
            this.parameterListeners.get(endpointID)?.forEach((listener) => listener(value));
        });
    }

    sendEventOrValue(endpointID, value) {
        this.parameterValues.set(endpointID, value);
        this.parameterListeners.get(endpointID)?.forEach((listener) => listener(value));
    }

    sendParameterGestureStart() {}

    sendParameterGestureEnd() {}

    addEndpointListener(endpointID, listener) {
        const listeners = this.endpointListeners.get(endpointID) ?? new Set();
        listeners.add(listener);
        this.endpointListeners.set(endpointID, listeners);
    }

    removeEndpointListener(endpointID, listener) {
        this.endpointListeners.get(endpointID)?.delete(listener);
    }

    sendMIDIInputEvent(endpointID, value) {
        this.endpointListeners.get(endpointID)?.forEach((listener) => listener({ message: value }));
    }

    addStatusListener(listener) {
        this.statusListeners.add(listener);
    }

    removeStatusListener(listener) {
        this.statusListeners.delete(listener);
    }

    requestStatusUpdate() {
        queueMicrotask(() => {
            this.statusListeners.forEach((listener) => listener(this.status));
        });
    }
}

async function loadManifest() {
    const response = await fetch("../WavetableSynth.iOS.cmajorpatch");

    if (!response.ok) {
        throw new Error(`Could not load patch manifest: ${response.status}`);
    }

    return response.json();
}

function writeMetrics(patchView) {
    const host = document.getElementById("host");
    const metricsNode = document.getElementById("harness-metrics");
    const shell = patchView.shadowRoot?.querySelector(".ios-shell");
    const stage = patchView.shadowRoot?.querySelector(".wavetable-stage");
    const shellNode = shell ?? patchView;
    const shellRect = shellNode.getBoundingClientRect();
    const stageRect = stage?.getBoundingClientRect();
    const shadowText = patchView.shadowRoot?.textContent ?? "";

    const metrics = {
        hostWidth: Math.round(host.getBoundingClientRect().width),
        patchWidth: Math.round(shellRect.width),
        patchClientWidth: Math.round(shellNode.clientWidth),
        patchClientHeight: Math.round(shellNode.clientHeight),
        patchScrollWidth: Math.round(shellNode.scrollWidth),
        patchScrollHeight: Math.round(shellNode.scrollHeight),
        scanRailCount: patchView.shadowRoot?.querySelectorAll(".scan-slider").length ?? 0,
        knobCount: patchView.shadowRoot?.querySelectorAll(".cosimo-knob").length ?? 0,
        keyboardDockCount: patchView.shadowRoot?.querySelectorAll(".keyboard-panel").length ?? 0,
        stageWidth: stageRect ? Math.round(stageRect.width) : 0,
        stageLeftInset: stageRect ? Math.round(stageRect.left - shellRect.left) : null,
        stageRightInset: stageRect ? Math.round(shellRect.right - stageRect.right) : null,
        stageCenterOffset: stageRect
            ? Math.round((((stageRect.left + stageRect.right) * 0.5) - ((shellRect.left + shellRect.right) * 0.5)) * 10) / 10
            : null,
        hasNarrativeTopline: shadowText.includes("Full-width phone layout"),
        hasNarrativeRailNote: shadowText.includes("The scan rail stays primary") || shadowText.includes("The knob becomes a scan rail"),
        hasNarrativeKeyboardNote: shadowText.includes("The keyboard area stays light because the host keyboard styling is limited"),
        hasPlayViewLabel: shadowText.includes("Play view"),
    };

    metricsNode.textContent = JSON.stringify(metrics);
}

const host = document.getElementById("host");
const manifest = await loadManifest();
const patchConnection = new MockPatchConnection(manifest);
const patchView = createIOSPatchView(patchConnection);

host.appendChild(patchView);

requestAnimationFrame(() => {
    requestAnimationFrame(() => {
        writeMetrics(patchView);
    });
});
