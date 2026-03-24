import createPatchView from "./index.js";

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
                    border-radius: 10px;
                    border: 1px dashed rgba(255, 255, 255, 0.1);
                    background:
                        repeating-linear-gradient(
                            90deg,
                            rgba(255, 255, 255, 0.9) 0,
                            rgba(255, 255, 255, 0.9) 22px,
                            rgba(216, 199, 151, 0.95) 22px,
                            rgba(216, 199, 151, 0.95) 24px
                        );
                }
            </style>
            <div class="note-holder" tabindex="0" title="Harness keyboard placeholder"></div>
        `;
    }

    handleExternalMIDI() {}
}

class MockPatchConnection {
    constructor(manifest) {
        this.manifest = manifest;
        this.parameterValues = new Map([[wavetablePositionEndpointID, 0.5]]);
        this.parameterListeners = new Map();
        this.endpointListeners = new Map();
        this.utilities = {
            PianoKeyboard: MockPianoKeyboard,
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
}

async function loadManifest() {
    const response = await fetch("../WavetableSynth.cmajorpatch");

    if (!response.ok) {
        throw new Error(`Could not load patch manifest: ${response.status}`);
    }

    return response.json();
}

const host = document.getElementById("host");
const positionInput = document.getElementById("position");
const positionValue = document.getElementById("position-value");
const animateInput = document.getElementById("animate");
const status = document.getElementById("status");

const manifest = await loadManifest();
const patchConnection = new MockPatchConnection(manifest);
const patchView = createPatchView(patchConnection);
host.appendChild(patchView);

function setPosition(value) {
    const numericValue = Number(value);
    positionInput.value = numericValue.toFixed(3);
    positionValue.textContent = numericValue.toFixed(3);
    patchConnection.sendEventOrValue(wavetablePositionEndpointID, numericValue);
}

positionInput.addEventListener("input", () => setPosition(positionInput.value));
setPosition(positionInput.value);

let animationFrame = null;
let animationStart = performance.now();

function tick(now) {
    const phase = ((now - animationStart) / 4000) % 1;
    setPosition(phase);
    animationFrame = requestAnimationFrame(tick);
}

animateInput.addEventListener("change", () => {
    if (animateInput.checked) {
        animationStart = performance.now();
        animationFrame = requestAnimationFrame(tick);
    } else if (animationFrame !== null) {
        cancelAnimationFrame(animationFrame);
        animationFrame = null;
    }
});

status.textContent = "Harness ready • using the real patch UI with a mock patch connection";

patchConnection.addEndpointListener(midiInputEndpointID, () => {});
