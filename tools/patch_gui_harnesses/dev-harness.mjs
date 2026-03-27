import createPatchView from "../../patch_gui/index.js";

const midiInputEndpointID = "midiIn";
const wavetablePositionEndpointID = "wavetablePosition";
const wavetableSelectEndpointID = "wavetableSelect";

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

    attachToPatchConnection() {}

    detachPatchConnection() {}
}

class MockKnob extends HTMLElement {
    constructor(patchConnection, endpointInfo) {
        super();
        this.patchConnection = patchConnection;
        this.endpointInfo = endpointInfo;
        this.value = endpointInfo?.annotation?.init ?? 0;
        this.className = "knob-container";
        this.innerHTML = `
            <style>
                :host {
                    display: inline-grid;
                    place-items: center;
                    width: 100%;
                    height: 100%;
                }

                .mock-knob {
                    width: 70%;
                    height: 70%;
                    border-radius: 999px;
                    border: 6px solid rgba(112, 128, 214, 0.28);
                    background: radial-gradient(circle at 32% 28%, #434f95 0%, #1d2450 42%, #090d1f 100%);
                    position: relative;
                }

                .tick {
                    position: absolute;
                    left: calc(50% - 2px);
                    top: 12px;
                    width: 4px;
                    height: 27px;
                    border-radius: 999px;
                    background: linear-gradient(180deg, #ffd9a4 0%, #f56cb6 100%);
                }
            </style>
            <div class="mock-knob">
                <div class="tick"></div>
            </div>
        `;

        this.tick = this.querySelector(".mock-knob");
        this.listener = (value) => this.valueChanged(value);
        this.patchConnection.addParameterListener(this.endpointInfo.endpointID, this.listener);
        this.patchConnection.requestParameterValue(this.endpointInfo.endpointID);
    }

    valueChanged(value) {
        const numeric = Number(value) || 0;
        this.value = numeric;
        const rotation = -132 + (264 * numeric);
        this.tick.style.transform = `rotate(${rotation}deg)`;
    }
}

class MockPatchConnection {
    constructor(manifest) {
        this.manifest = manifest;
        this.parameterValues = new Map([
            [wavetablePositionEndpointID, 0.5],
            [wavetableSelectEndpointID, 0],
        ]);
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
                            init: 0.0,
                        },
                    },
                    {
                        endpointID: wavetableSelectEndpointID,
                        purpose: "parameter",
                        annotation: {
                            name: "Wavetable Select",
                            min: 0.0,
                            max: 255.0,
                            init: 0.0,
                        },
                    },
                ],
            },
        };
        this.utilities = {
            PianoKeyboard: MockPianoKeyboard,
            ParameterControls: {
                Knob: MockKnob,
            },
        };
    }

    getResourceAddress(path) {
        const relativePath = path.startsWith("/") ? path.slice(1) : path;
        return `../../${relativePath}`;
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
    const response = await fetch("../../WavetableSynth.cmajorpatch");

    if (!response.ok) {
        throw new Error(`Could not load patch manifest: ${response.status}`);
    }

    return response.json();
}

const host = document.getElementById("host");
const positionInput = document.getElementById("position");
const positionValue = document.getElementById("position-value");
const tableSelectInput = document.getElementById("table-select");
const tableSelectValue = document.getElementById("table-select-value");
const animateInput = document.getElementById("animate");
const status = document.getElementById("status");

const [manifest, bankCatalog] = await Promise.all([
    loadManifest(),
    fetch("../../assets/factory-bank-catalog.json").then((response) => {
        if (!response.ok) {
            throw new Error(`Could not load factory bank catalog: ${response.status}`);
        }

        return response.json();
    }),
]);
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

function setTableSelect(value) {
    const numericValue = Math.round(Number(value) || 0);
    tableSelectInput.value = String(numericValue);
    tableSelectValue.textContent = String(numericValue);
    patchConnection.sendEventOrValue(wavetableSelectEndpointID, numericValue);
}

bankCatalog.tables.forEach((table, tableIndex) => {
    const option = document.createElement("option");
    option.value = String(tableIndex);
    option.textContent = table.name;
    tableSelectInput.appendChild(option);
});

tableSelectInput.addEventListener("change", () => setTableSelect(tableSelectInput.value));
setTableSelect(0);

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

status.textContent = "Harness ready • using the real patch UI with the generated factory bank catalog";

patchConnection.addEndpointListener(midiInputEndpointID, () => {});
